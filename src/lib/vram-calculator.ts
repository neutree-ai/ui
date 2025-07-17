import type { ModelConfig } from "../data/models";

export type QuantizationType = "fp32" | "fp16" | "bf16" | "int8" | "int4";

// Inference configuration constants - centralized management of empirical parameters
const INFERENCE_CONFIG = {
  ACTIVATION_COEFFICIENT: 0.5, // Activation coefficient (reduction compared to training)
  OPTIMIZATION_FACTOR: 0.7, // Inference engine optimization factor (KV Cache and activation reduction)
  MULTI_DEVICE_OVERHEAD: 0.05, // Multi-GPU communication overhead factor
  BASE_GENERATION_SPEED: 100, // Base generation speed (tokens/sec)
  KV_COMPONENTS: 2, // Number of KV Cache components (Key + Value)
} as const;

// vLLM specific configuration for PagedAttention and continuous batching
const VLLM_CONFIG = {
  // Fraction of concurrent users that are typically active simultaneously
  // In practice, not all concurrent users are being processed at the same time
  ACTIVE_USER_RATIO: 0.3,

  // vLLM memory pool additional overhead for page management
  MEMORY_POOL_OVERHEAD: 1.15,
} as const;

export interface CalculationInputs {
  model: ModelConfig;
  quantization: QuantizationType;
  kvQuantization: QuantizationType;
  batchSize: number;
  sequenceLength: number;
  numGpus: number;
  customVram: number;
  concurrentUsers: number;
}

export interface MemoryItem {
  key: string;
  memoryGB: number;
  percentage: number;
  color: string;
  visible?: boolean;
}

export interface StackBarItem {
  key: string;
  memoryGB: number;
  percentage: number;
  color: string;
  label: string;
}

export type MemoryStatus =
  | "ready"
  | "okay"
  | "moderate"
  | "high"
  | "very_high"
  | "insufficient";

export interface CalculationResults {
  total: {
    totalVram: number;
    availableVram: number;
    utilizationPercent: number;
  };

  memoryBreakdown: MemoryItem[];
  stackBarData: StackBarItem[];
  memoryStatus: MemoryStatus;
  statusColor: string;
  generationSpeed: number;
  totalThroughput: number;
  numGpus: number;

  raw: {
    modelWeights: number;
    kvCache: number;
    activations: number;
    multiDeviceOverhead: number;
    framework: number;
  };
}

function getQuantizationBytes(quantization: QuantizationType): number {
  switch (quantization) {
    case "fp32":
      return 4;
    case "fp16":
    case "bf16":
      return 2;
    case "int8":
      return 1;
    case "int4":
      return 0.5;
    default:
      return 2;
  }
}

function getKVCacheCoeff(attentionStructure: string): number {
  switch (attentionStructure) {
    case "mha":
      return 1.0;
    case "gqa":
      return 0.25;
    case "mqa":
      return 0.125;
    case "mla":
      return 0.1;
    default:
      return 1.0;
  }
}

function calculateModelWeights(
  model: ModelConfig,
  quantization: QuantizationType,
): number {
  const bytesPerParam = getQuantizationBytes(quantization);
  return model.params * bytesPerParam;
}

function calculateKVCache(
  model: ModelConfig,
  kvQuantization: QuantizationType,
  batchSize: number,
  sequenceLength: number,
  concurrentUsers: number,
): number {
  const bytesPerToken = getQuantizationBytes(kvQuantization);
  const kvCoeff = getKVCacheCoeff(model.attentionStructure);

  const kvHeads = model.kvHeads;
  const headDim = model.hiddenSize / model.attentionHeads;

  // Base KV Cache size per token per sequence
  const cachePerToken =
    INFERENCE_CONFIG.KV_COMPONENTS * // K and V components
    model.layers *
    kvHeads *
    headDim *
    bytesPerToken *
    kvCoeff;

  // vLLM KV Cache calculation:
  // 1. Primary factor: effective batch size (sequences being processed simultaneously)
  // 2. PagedAttention allows dynamic allocation and sharing
  // 3. Concurrent users affect the scheduling but not direct memory usage

  // Effective batch size considering vLLM's continuous batching
  // Not all concurrent users are processed simultaneously
  const effectiveBatch = Math.min(
    batchSize,
    Math.ceil(concurrentUsers * VLLM_CONFIG.ACTIVE_USER_RATIO),
  );

  // Total KV Cache: effective batch × sequence length × cache per token
  const kvCacheSize = effectiveBatch * sequenceLength * cachePerToken;

  // Apply vLLM memory pool overhead for page management
  const finalCacheSize = kvCacheSize * VLLM_CONFIG.MEMORY_POOL_OVERHEAD;

  return finalCacheSize / 1024 ** 3;
}

function calculateActivations(
  model: ModelConfig,
  batchSize: number,
  sequenceLength: number,
): number {
  // For inference, activations are much smaller than training
  // Only forward pass activations are needed, not backward pass gradients
  // Modern frameworks use activation checkpointing and memory optimization

  // Rough estimation: activation memory scales more moderately with batch size
  // Formula based on transformer architecture: roughly hiddenSize * seqLen * batchSize * layers
  // But with optimizations, the multiplier is much smaller (empirical coefficient for inference)
  const activationSize =
    batchSize *
    sequenceLength *
    model.hiddenSize *
    INFERENCE_CONFIG.ACTIVATION_COEFFICIENT;

  return activationSize / 1024 ** 3;
}

function calculateFrameworkOverhead(
  availableVramPerGpu: number,
  numGpus = 1,
): number {
  // Framework overhead includes:
  // 1. CUDA context and driver overhead
  // 2. Framework runtime (PyTorch, vLLM engine)
  // 3. Model loading and initialization buffers
  // 4. Operator kernels and temporary buffers
  // 5. Memory fragmentation and alignment overhead

  let baseOverhead = 1.0;

  // Scale overhead with GPU memory capacity
  // Larger GPUs typically run more complex workloads requiring more framework overhead
  if (availableVramPerGpu >= 80) {
    baseOverhead = 2.0; // H100, A100 80GB
  } else if (availableVramPerGpu >= 40) {
    baseOverhead = 1.5; // A100 40GB, A6000
  } else if (availableVramPerGpu >= 24) {
    baseOverhead = 1.2; // RTX 4090, RTX 3090
  } else if (availableVramPerGpu >= 16) {
    baseOverhead = 1.0; // RTX 4070 Ti, V100
  } else {
    baseOverhead = 0.8; // Smaller GPUs
  }

  // Multi-GPU setups have slightly lower per-GPU overhead due to shared components
  const multiGpuEfficiency = numGpus > 1 ? 0.9 : 1.0;

  return baseOverhead * multiGpuEfficiency;
}

function calculateMultiDeviceOverhead(
  baseVramUsage: number,
  numGpus: number,
): number {
  if (numGpus <= 1) {
    return 0;
  }

  // Multi-GPU overhead includes:
  // 1. NCCL/communication library overhead
  // 2. Synchronization buffers
  // 3. Model sharding metadata
  // 4. All-reduce temporary buffers
  const scalingFactor = Math.sqrt(numGpus);

  return baseVramUsage * INFERENCE_CONFIG.MULTI_DEVICE_OVERHEAD * scalingFactor;
}

function getMemoryStatus(utilizationPercent: number): {
  status: MemoryStatus;
  color: string;
} {
  if (utilizationPercent > 100) {
    return { status: "insufficient", color: "#e03131" };
  }
  if (utilizationPercent > 95) {
    return { status: "very_high", color: "#ff6b6b" };
  }
  if (utilizationPercent > 85) {
    return { status: "high", color: "#ff8c42" };
  }
  if (utilizationPercent > 70) {
    return { status: "moderate", color: "#ffd43b" };
  }
  if (utilizationPercent > 50) {
    return { status: "okay", color: "#51cf66" };
  }
  return { status: "ready", color: "#40c057" };
}

function createMemoryItem(
  key: string,
  memoryGB: number,
  totalAvailableVram: number,
  color: string,
  visible = true,
): MemoryItem {
  return {
    key,
    memoryGB,
    percentage: (memoryGB / totalAvailableVram) * 100,
    color,
    visible,
  };
}

function estimateGenerationSpeed(
  model: ModelConfig,
  availableVram: number,
  batchSize: number,
): number {
  const modelSizeFactor = Math.max(0.1, 1 / Math.sqrt(model.params / 7));
  const memoryFactor = Math.min(2, availableVram / 24);
  const batchFactor = 1 / Math.sqrt(batchSize);

  return (
    INFERENCE_CONFIG.BASE_GENERATION_SPEED *
    modelSizeFactor *
    memoryFactor *
    batchFactor
  );
}

export function calculateVRAMRequirements(
  inputs: CalculationInputs,
): CalculationResults {
  const {
    model,
    quantization,
    kvQuantization,
    batchSize,
    sequenceLength,
    numGpus,
    customVram,
    concurrentUsers,
  } = inputs;

  const totalAvailableVram = customVram * numGpus;

  const modelWeights = calculateModelWeights(model, quantization);
  const kvCache = calculateKVCache(
    model,
    kvQuantization,
    batchSize,
    sequenceLength,
    concurrentUsers,
  );
  const activations = calculateActivations(model, batchSize, sequenceLength);

  // Apply inference optimization factor for modern engines like vLLM
  // These engines use techniques like PagedAttention, continuous batching, etc.
  const optimizedKvCache = kvCache * INFERENCE_CONFIG.OPTIMIZATION_FACTOR;
  const optimizedActivations =
    activations * INFERENCE_CONFIG.OPTIMIZATION_FACTOR;

  const baseVramUsage =
    modelWeights + optimizedKvCache / numGpus + optimizedActivations / numGpus;
  const multiDeviceOverhead = calculateMultiDeviceOverhead(
    baseVramUsage,
    numGpus,
  );
  const framework = calculateFrameworkOverhead(customVram, numGpus);

  const totalVram =
    modelWeights +
    optimizedKvCache +
    optimizedActivations +
    multiDeviceOverhead +
    framework;

  const totalUtilization = (totalVram / totalAvailableVram) * 100;

  const statusInfo = getMemoryStatus(totalUtilization);

  const memoryBreakdown: MemoryItem[] = [
    createMemoryItem("modelWeights", modelWeights, customVram, "#3b82f6"),
    createMemoryItem(
      "kvCache",
      optimizedKvCache / numGpus,
      customVram,
      "#e879f9",
    ),
    createMemoryItem(
      "activations",
      optimizedActivations / numGpus,
      customVram,
      "#10b981",
    ),
    createMemoryItem(
      "multiDeviceOverhead",
      multiDeviceOverhead,
      customVram,
      "#f97316",
      numGpus > 1,
    ),
    createMemoryItem("frameworkOverhead", framework, customVram, "#f59e0b"),
  ];

  const singleGpuTotalUsed =
    modelWeights +
    optimizedKvCache / numGpus +
    optimizedActivations / numGpus +
    multiDeviceOverhead +
    framework;

  const stackBarData: StackBarItem[] = [
    {
      key: "modelWeights",
      memoryGB: modelWeights,
      percentage: (modelWeights / singleGpuTotalUsed) * 100,
      color: "#3b82f6",
      label: `${((modelWeights / singleGpuTotalUsed) * 100).toFixed(1)}%`,
    },
    {
      key: "kvCache",
      memoryGB: optimizedKvCache / numGpus,
      percentage: (optimizedKvCache / numGpus / singleGpuTotalUsed) * 100,
      color: "#e879f9",
      label: `${((optimizedKvCache / numGpus / singleGpuTotalUsed) * 100).toFixed(1)}%`,
    },
    {
      key: "activations",
      memoryGB: optimizedActivations / numGpus,
      percentage: (optimizedActivations / numGpus / singleGpuTotalUsed) * 100,
      color: "#10b981",
      label: `${((optimizedActivations / numGpus / singleGpuTotalUsed) * 100).toFixed(1)}%`,
    },
  ];

  if (numGpus > 1) {
    stackBarData.push({
      key: "multiDeviceOverhead",
      memoryGB: multiDeviceOverhead,
      percentage: (multiDeviceOverhead / singleGpuTotalUsed) * 100,
      color: "#f97316",
      label: `${((multiDeviceOverhead / singleGpuTotalUsed) * 100).toFixed(1)}%`,
    });
  }

  stackBarData.push({
    key: "frameworkOverhead",
    memoryGB: framework,
    percentage: (framework / singleGpuTotalUsed) * 100,
    color: "#f59e0b",
    label: `${((framework / singleGpuTotalUsed) * 100).toFixed(1)}%`,
  });

  const generationSpeed = estimateGenerationSpeed(
    model,
    totalAvailableVram,
    batchSize,
  );
  const totalThroughput = generationSpeed * batchSize;

  return {
    total: {
      totalVram,
      availableVram: totalAvailableVram,
      utilizationPercent: Math.min(totalUtilization, 999),
    },
    memoryBreakdown,
    stackBarData,
    memoryStatus: statusInfo.status,
    statusColor: statusInfo.color,
    generationSpeed,
    totalThroughput,
    numGpus,
    raw: {
      modelWeights,
      kvCache: optimizedKvCache,
      activations: optimizedActivations,
      multiDeviceOverhead,
      framework,
    },
  };
}

export function formatMemorySize(sizeGB: number): string {
  if (sizeGB < 1) {
    return `${(sizeGB * 1024).toFixed(0)} MB`;
  }
  return `${sizeGB.toFixed(1)} GB`;
}

export function formatPerformance(tokensPerSecond: number): string {
  if (tokensPerSecond < 1) {
    return `${tokensPerSecond.toFixed(2)} tok/sec`;
  }
  return `${Math.round(tokensPerSecond)} tok/sec`;
}
