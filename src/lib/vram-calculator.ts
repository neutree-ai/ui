import type { ModelConfig } from "../data/models";

export type QuantizationType = "fp32" | "fp16" | "bf16" | "int8" | "int4";

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
  cpuMemory: number;
  cpuCores: number;
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

  // For inference, KV cache grows with batch size, but not as dramatically as training
  // vLLM and similar engines use PagedAttention which reduces actual memory usage
  // The effective batch for KV cache is typically the actual batch size being processed
  const effectiveBatch = batchSize;

  // Use key-value head count and calculated head dimension for more accurate calculation
  // KV cache size = 2 (K+V) * layers * kv_heads * head_dim * seq_len * batch * bytes
  const kvHeads = model.kvHeads;
  const headDim = model.hiddenSize / model.attentionHeads; // Head dimension

  const kvCacheSize =
    2 * // K and V
    model.layers *
    kvHeads *
    headDim *
    sequenceLength *
    effectiveBatch *
    bytesPerToken *
    kvCoeff;

  return kvCacheSize / 1024 ** 3;
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
  // But with optimizations, the multiplier is much smaller (around 0.5-1 instead of 4)
  const activationSize = batchSize * sequenceLength * model.hiddenSize * 0.5; // Much smaller coefficient for inference

  return activationSize / 1024 ** 3;
}

function calculateFrameworkOverhead(
  availableVramPerGpu: number,
  numGpus = 1,
): number {
  let baseOverhead = 1.0;

  if (availableVramPerGpu >= 80) {
    baseOverhead = 2.0;
  } else if (availableVramPerGpu >= 40) {
    baseOverhead = 1.5;
  } else if (availableVramPerGpu >= 24) {
    baseOverhead = 1.2;
  } else if (availableVramPerGpu >= 16) {
    baseOverhead = 1.0;
  } else {
    baseOverhead = 0.8;
  }

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

  const overheadFactor = 0.05;
  const scalingFactor = Math.sqrt(numGpus);

  return baseVramUsage * overheadFactor * scalingFactor;
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
  const baseSpeed = 100;
  const modelSizeFactor = Math.max(0.1, 1 / Math.sqrt(model.params / 7));
  const memoryFactor = Math.min(2, availableVram / 24);
  const batchFactor = 1 / Math.sqrt(batchSize);

  return baseSpeed * modelSizeFactor * memoryFactor * batchFactor;
}

function calculateCPUMemory(
  model: ModelConfig,
  quantization: QuantizationType,
  sequenceLength: number,
  mode: "uvm" | "control_plane" = "control_plane",
): number {
  if (mode === "uvm") {
    const P = model.params * 10 ** 9;
    const B = getQuantizationBytes(quantization);
    const alpha = 1.25;
    const L = sequenceLength;
    const delta = 0.2;

    const W_CPU = P * B;
    const K_CPU = P * alpha * L * B;
    const RAM_CPU = (W_CPU + K_CPU) * (1 + delta);

    return RAM_CPU / 1024 ** 3;
  }

  const R_fw = 10;
  const R_os = 6;
  const R_mon = 3;
  const delta = 0.2;

  return (R_fw + R_os + R_mon) * (1 + delta);
}

function calculateCPUCores(numGpus: number, concurrentUsers: number): number {
  const c_g = 10;
  const c_r = 5;

  return numGpus * c_g + concurrentUsers * c_r;
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
  const inferenceOptimizationFactor = 0.7; // 30% reduction from optimizations
  const optimizedKvCache = kvCache * inferenceOptimizationFactor;
  const optimizedActivations = activations * inferenceOptimizationFactor;

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

  const cpuMemory = calculateCPUMemory(model, quantization, sequenceLength);
  const cpuCores = calculateCPUCores(numGpus, concurrentUsers);

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
    cpuMemory,
    cpuCores,
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
