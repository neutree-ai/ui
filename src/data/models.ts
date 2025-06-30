export interface ModelConfig {
  id: string;
  name: string;
  params: number; // Parameters in billions
  layers: number;
  hiddenSize: number;
  attentionHeads: number;
  kvHeads: number;
  architecture: "dense" | "moe";
  attentionStructure: "mha" | "gqa" | "mqa" | "mla";
  contextLength?: number;
}

export const MODELS: ModelConfig[] = [
  // Llama series
  {
    id: "llama-3.1-8b",
    name: "Llama 3.1 8B",
    params: 8,
    layers: 32,
    hiddenSize: 4096,
    attentionHeads: 32,
    kvHeads: 8,
    architecture: "dense",
    attentionStructure: "gqa",
    contextLength: 128000,
  },
  {
    id: "llama-3.1-70b",
    name: "Llama 3.1 70B",
    params: 70,
    layers: 80,
    hiddenSize: 8192,
    attentionHeads: 64,
    kvHeads: 8,
    architecture: "dense",
    attentionStructure: "gqa",
    contextLength: 128000,
  },
  {
    id: "llama-3.3-70b",
    name: "Llama 3.3 70B",
    params: 70,
    layers: 80,
    hiddenSize: 8192,
    attentionHeads: 64,
    kvHeads: 8,
    architecture: "dense",
    attentionStructure: "gqa",
    contextLength: 128000,
  },

  // Qwen series
  {
    id: "qwen2.5-7b",
    name: "Qwen2.5 7B",
    params: 7,
    layers: 32,
    hiddenSize: 4096,
    attentionHeads: 64,
    kvHeads: 8,
    architecture: "dense",
    attentionStructure: "gqa",
    contextLength: 32768,
  },
  {
    id: "qwen2.5-14b",
    name: "Qwen2.5 14B",
    params: 14,
    layers: 40,
    hiddenSize: 5120,
    attentionHeads: 80,
    kvHeads: 8,
    architecture: "dense",
    attentionStructure: "gqa",
    contextLength: 32768,
  },
  {
    id: "qwen2.5-32b",
    name: "Qwen2.5 32B",
    params: 32.5,
    layers: 64,
    hiddenSize: 5120,
    attentionHeads: 40,
    kvHeads: 8,
    architecture: "dense",
    attentionStructure: "gqa",
    contextLength: 32768,
  },
  {
    id: "qwen2.5-72b",
    name: "Qwen2.5 72B",
    params: 72,
    layers: 80,
    hiddenSize: 12288,
    attentionHeads: 128,
    kvHeads: 8,
    architecture: "dense",
    attentionStructure: "gqa",
    contextLength: 32768,
  },

  // DeepSeek series
  {
    id: "deepseek-r1-8b",
    name: "DeepSeek-R1 8B",
    params: 8,
    layers: 40,
    hiddenSize: 4096,
    attentionHeads: 64,
    kvHeads: 64,
    architecture: "dense",
    attentionStructure: "mla",
    contextLength: 64000,
  },
  {
    id: "deepseek-r1-70b",
    name: "DeepSeek-R1 70B",
    params: 70,
    layers: 80,
    hiddenSize: 8192,
    attentionHeads: 112,
    kvHeads: 112,
    architecture: "dense",
    attentionStructure: "mla",
    contextLength: 64000,
  },

  // Gemma series
  {
    id: "gemma-2-9b",
    name: "Gemma 2 9B",
    params: 9,
    layers: 42,
    hiddenSize: 2304,
    attentionHeads: 32,
    kvHeads: 8,
    architecture: "dense",
    attentionStructure: "gqa",
    contextLength: 8192,
  },
  {
    id: "gemma-2-27b",
    name: "Gemma 2 27B",
    params: 27,
    layers: 46,
    hiddenSize: 4096,
    attentionHeads: 32,
    kvHeads: 16,
    architecture: "dense",
    attentionStructure: "gqa",
    contextLength: 8192,
  },

  // Mistral series
  {
    id: "mistral-7b",
    name: "Mistral 7B",
    params: 7.3,
    layers: 32,
    hiddenSize: 4096,
    attentionHeads: 32,
    kvHeads: 8,
    architecture: "dense",
    attentionStructure: "gqa",
    contextLength: 32768,
  },
  {
    id: "mixtral-8x7b",
    name: "Mixtral 8x7B",
    params: 46.7,
    layers: 32,
    hiddenSize: 4096,
    attentionHeads: 32,
    kvHeads: 8,
    architecture: "moe",
    attentionStructure: "gqa",
    contextLength: 32768,
  },
];

// GPU config
export interface GPUConfig {
  id: string;
  name: string;
  memory: number; // GB
  accelerator: "nvidia_gpu" | "custom";
}

export const GPUS: GPUConfig[] = [
  // Consumer GPUs - RTX 30 Series
  {
    id: "rtx3060",
    name: "RTX 3060 12GB",
    memory: 12,
    accelerator: "nvidia_gpu",
  },
  { id: "rtx3070", name: "RTX 3070 8GB", memory: 8, accelerator: "nvidia_gpu" },
  {
    id: "rtx3080",
    name: "RTX 3080 10GB",
    memory: 10,
    accelerator: "nvidia_gpu",
  },
  {
    id: "rtx3090",
    name: "RTX 3090 24GB",
    memory: 24,
    accelerator: "nvidia_gpu",
  },

  // Consumer GPUs - RTX 40 Series
  {
    id: "rtx4060ti",
    name: "RTX 4060 Ti 16GB",
    memory: 16,
    accelerator: "nvidia_gpu",
  },
  {
    id: "rtx4070",
    name: "RTX 4070 12GB",
    memory: 12,
    accelerator: "nvidia_gpu",
  },
  {
    id: "rtx4070s",
    name: "RTX 4070 Super 12GB",
    memory: 12,
    accelerator: "nvidia_gpu",
  },
  {
    id: "rtx4080",
    name: "RTX 4080 16GB",
    memory: 16,
    accelerator: "nvidia_gpu",
  },
  {
    id: "rtx4080s",
    name: "RTX 4080 Super 16GB",
    memory: 16,
    accelerator: "nvidia_gpu",
  },
  {
    id: "rtx4090",
    name: "RTX 4090 24GB",
    memory: 24,
    accelerator: "nvidia_gpu",
  },

  // Consumer GPUs - RTX 50 Series
  {
    id: "rtx5070",
    name: "RTX 5070 12GB",
    memory: 12,
    accelerator: "nvidia_gpu",
  },
  {
    id: "rtx5070ti",
    name: "RTX 5070 Ti 16GB",
    memory: 16,
    accelerator: "nvidia_gpu",
  },
  {
    id: "rtx5080",
    name: "RTX 5080 16GB",
    memory: 16,
    accelerator: "nvidia_gpu",
  },
  {
    id: "rtx5090",
    name: "RTX 5090 32GB",
    memory: 32,
    accelerator: "nvidia_gpu",
  },

  // Datacenter GPUs - Tesla/Quadro
  { id: "t4", name: "Tesla T4 16GB", memory: 16, accelerator: "nvidia_gpu" },
  {
    id: "v100",
    name: "Tesla V100 32GB",
    memory: 32,
    accelerator: "nvidia_gpu",
  },
  { id: "a10", name: "A10 24GB", memory: 24, accelerator: "nvidia_gpu" },
  { id: "a40", name: "A40 48GB", memory: 48, accelerator: "nvidia_gpu" },
  { id: "a100", name: "A100 80GB", memory: 80, accelerator: "nvidia_gpu" },

  // Datacenter GPUs - H Series
  { id: "h20", name: "H20 96GB", memory: 96, accelerator: "nvidia_gpu" },
  { id: "h100", name: "H100 80GB", memory: 80, accelerator: "nvidia_gpu" },
  { id: "h200", name: "H200 141GB", memory: 141, accelerator: "nvidia_gpu" },

  // Datacenter GPUs - L Series
  { id: "l4", name: "L4 24GB", memory: 24, accelerator: "nvidia_gpu" },
  { id: "l20", name: "L20 48GB", memory: 48, accelerator: "nvidia_gpu" },
  { id: "l40", name: "L40 48GB", memory: 48, accelerator: "nvidia_gpu" },
  { id: "l40s", name: "L40S 48GB", memory: 48, accelerator: "nvidia_gpu" },

  {
    id: "rtx4090d",
    name: "RTX 4090D 24GB",
    memory: 24,
    accelerator: "nvidia_gpu",
  },
  {
    id: "a800",
    name: "A800 80GB",
    memory: 80,
    accelerator: "nvidia_gpu",
  },
  {
    id: "h800",
    name: "H800 80GB",
    memory: 80,
    accelerator: "nvidia_gpu",
  },

  // Custom option
  { id: "custom", name: "Custom Memory", memory: 0, accelerator: "custom" },
];
