import type { ResourceSpec } from "@/foundation/types/serving-types";

/**
 * Validate current usage against total capacity.
 * Current usage is the endpoint's existing allocation, so it must not exceed total capacity.
 * If it does, return 0 (reset).
 */
export function validateCurrentUsage(
  currentUsage: number,
  totalCapacity: number,
): number {
  return Number(currentUsage || 0) <= totalCapacity
    ? Number(currentUsage || 0)
    : 0;
}

/**
 * Deep merge function for form data with smart overriding.
 * - Recursively merges nested objects
 * - Skips null/undefined values from source (preserves target)
 * - Arrays are replaced, not merged
 */
export function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  if (source === null || source === undefined) return target;
  if (target === null || target === undefined) return source;

  if (typeof source !== "object" || typeof target !== "object") {
    return source;
  }

  const result = { ...target };

  for (const key of Object.keys(source)) {
    const sourceValue = source[key];
    if (sourceValue === null || sourceValue === undefined) {
      continue; // Skip null/undefined values from source
    }

    const targetValue = target[key];

    // Special handling for nested objects
    if (
      typeof sourceValue === "object" &&
      typeof targetValue === "object" &&
      !Array.isArray(sourceValue) &&
      !Array.isArray(targetValue)
    ) {
      result[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>,
      );
    } else {
      result[key] = sourceValue;
    }
  }

  return result;
}

interface ResourcePool {
  available: number;
  total: number;
}

interface ResourceUsage {
  cpu: number;
  memory: number;
  gpu: number;
}

interface MaxAvailableResources {
  cpu: ResourcePool;
  memory: ResourcePool;
  gpu: ResourcePool;
}

const parseNumberForForm = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const parseMemoryGiBForForm = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  const direct = Number(trimmed);
  if (Number.isFinite(direct)) return direct;

  const match = trimmed.match(
    /^([0-9]+(?:\.[0-9]+)?)\s*(Ki|KiB|Mi|MiB|Gi|GiB|Ti|TiB)$/i,
  );
  if (!match) return null;

  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return null;

  switch (match[2].toLowerCase()) {
    case "ki":
    case "kib":
      return amount / 1024 / 1024;
    case "mi":
    case "mib":
      return amount / 1024;
    case "gi":
    case "gib":
      return amount;
    case "ti":
    case "tib":
      return amount * 1024;
    default:
      return null;
  }
};

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const setParsedResourceField = (
  target: Record<string, unknown>,
  source: Record<string, unknown>,
  key: "cpu" | "gpu" | "memory",
) => {
  if (!(key in source)) return;
  target[key] =
    key === "memory"
      ? parseMemoryGiBForForm(source[key])
      : parseNumberForForm(source[key]);
};

function normalizeEndpointAcceleratorForForm(
  accelerator: unknown,
): ResourceSpec["accelerator"] {
  if (accelerator === null || accelerator === undefined) return null;
  if (!isPlainRecord(accelerator)) return null;

  const normalized = {
    type: accelerator.type == null ? "" : String(accelerator.type),
    product: accelerator.product == null ? "" : String(accelerator.product),
  };

  if (!normalized.type && !normalized.product) return null;

  return normalized as ResourceSpec["accelerator"];
}

export function normalizeEndpointResourcesForForm(
  resources: Record<string, unknown> | ResourceSpec | null | undefined,
): ResourceSpec | null {
  if (!resources) return null;

  const source = resources as Record<string, unknown>;
  const normalized = { ...source };
  setParsedResourceField(normalized, source, "cpu");
  setParsedResourceField(normalized, source, "memory");
  setParsedResourceField(normalized, source, "gpu");
  normalized.accelerator = normalizeEndpointAcceleratorForForm(
    source.accelerator,
  );

  return normalized as ResourceSpec;
}

export function normalizeEndpointRecordForForm<
  T extends { spec?: { resources?: Record<string, unknown> | null } | null },
>(record: T): T {
  if (!record.spec) return record;

  return {
    ...record,
    spec: {
      ...record.spec,
      resources: normalizeEndpointResourcesForForm(record.spec.resources),
    },
  };
}

/**
 * Compute maximum available resources for the endpoint form sliders.
 *
 * When singleNodeMax is provided (accelerator selected), limits are based on
 * the best single node (TP deployment requires a single node).
 * Otherwise, falls back to cluster-level totals with gpu zeroed out.
 * currentUsage is added back so that the endpoint's own allocation remains usable.
 */
export function computeMaxAvailable(
  singleNodeMax: {
    cpu: ResourcePool;
    memory: ResourcePool;
    gpu: ResourcePool;
  } | null,
  clusterResources: {
    cpu: ResourcePool;
    memory: ResourcePool;
  } | null,
  currentUsage: ResourceUsage,
): MaxAvailableResources {
  if (singleNodeMax) {
    const validCurrentCpu = validateCurrentUsage(
      currentUsage.cpu,
      singleNodeMax.cpu.total,
    );
    const validCurrentMemory = validateCurrentUsage(
      currentUsage.memory,
      singleNodeMax.memory.total,
    );
    const validCurrentGpu = validateCurrentUsage(
      currentUsage.gpu,
      singleNodeMax.gpu.total,
    );

    return {
      cpu: {
        available: Math.min(
          singleNodeMax.cpu.available + validCurrentCpu,
          singleNodeMax.cpu.total,
        ),
        total: singleNodeMax.cpu.total,
      },
      memory: {
        available: Math.min(
          singleNodeMax.memory.available + validCurrentMemory,
          singleNodeMax.memory.total,
        ),
        total: singleNodeMax.memory.total,
      },
      gpu: {
        available: Math.min(
          singleNodeMax.gpu.available + validCurrentGpu,
          singleNodeMax.gpu.total,
        ),
        total: singleNodeMax.gpu.total,
      },
    };
  }

  if (!clusterResources) {
    return {
      cpu: { available: 0, total: 0 },
      memory: { available: 0, total: 0 },
      gpu: { available: 0, total: 0 },
    };
  }

  const clusterCpuAvailable = Number(clusterResources.cpu?.available || 0);
  const clusterMemoryAvailable = Number(
    clusterResources.memory?.available || 0,
  );

  const validCurrentCpu = validateCurrentUsage(
    currentUsage.cpu,
    clusterResources.cpu.total,
  );
  const validCurrentMemory = validateCurrentUsage(
    currentUsage.memory,
    clusterResources.memory.total,
  );

  return {
    cpu: {
      available: Math.min(
        clusterCpuAvailable + validCurrentCpu,
        clusterResources.cpu.total,
      ),
      total: clusterResources.cpu.total,
    },
    memory: {
      available: Math.min(
        clusterMemoryAvailable + validCurrentMemory,
        clusterResources.memory.total,
      ),
      total: clusterResources.memory.total,
    },
    gpu: { available: 0, total: 0 },
  };
}

/**
 * Transform endpoint spec values in-place before submission.
 * - Converts resource fields (cpu, memory, gpu) to strings for API compatibility
 * - Converts replicas.num from string (HTML input) to number
 */
export function transformEndpointValues(spec: {
  resources?: Record<string, unknown> | null;
  replicas?: { num?: unknown } | null;
}): void {
  if (spec.resources) {
    for (const field of ["cpu", "memory", "gpu"]) {
      const value = (spec.resources as Record<string, unknown>)[field];
      if (value != null) {
        (spec.resources as Record<string, unknown>)[field] = String(value);
      }
    }

    const accelerator = spec.resources.accelerator as
      | Record<string, unknown>
      | null
      | undefined;
    if (accelerator) {
      for (const [key, value] of Object.entries(accelerator)) {
        if (
          (key !== "type" && key !== "product") ||
          value === null ||
          value === undefined ||
          value === ""
        ) {
          delete accelerator[key];
        } else if (typeof value !== "string") {
          accelerator[key] = String(value);
        }
      }
      if (Object.keys(accelerator).length === 0) {
        spec.resources.accelerator = null;
      }
    }
  }
  if (spec.replicas?.num != null) {
    spec.replicas.num = Number(spec.replicas.num);
  }
}

/**
 * Validate endpoint spec values. Returns an errors map (empty = valid).
 */
export function validateEndpointValues(
  spec: {
    replicas?: { num?: number } | null;
    deployment_options?: { scheduler?: { type?: string } | null } | null;
  },
  context: {
    action: "create" | "edit";
    currentRegistry: string;
    currentModelName: string;
    availableModelNames: string[];
  },
  t: (key: string) => string,
): Record<string, { type: string; message: string }> {
  const errors: Record<string, { type: string; message: string }> = {};

  if (spec.replicas?.num != null && spec.replicas.num < 1) {
    errors["spec.replicas.num"] = {
      type: "manual",
      message: t("endpoints.messages.replicasMustBeAtLeastOne"),
    };
  }

  if (!spec.deployment_options?.scheduler?.type) {
    errors["spec.deployment_options.scheduler.type"] = {
      type: "manual",
      message: t("endpoints.messages.schedulerTypeRequired"),
    };
  }

  if (
    context.action === "create" &&
    context.currentRegistry &&
    context.currentModelName
  ) {
    if (!context.availableModelNames.includes(context.currentModelName)) {
      errors["-model-catalog"] = {
        type: "manual",
        message: t("endpoints.messages.modelNotFoundInRegistry"),
      };
    }
  }

  return errors;
}

/**
 * Build the merged spec from a catalog template and defaults.
 * Each key (except "cluster") is deep-merged: catalog values override defaults.
 * Null/missing catalog or null sections fall back to defaults entirely.
 * Returns a map of spec keys to their merged values, ready to apply to the form.
 */
export function buildCatalogMergedSpec(
  catalogSpec: Record<string, unknown> | null,
): Record<string, Record<string, unknown>> {
  const result: Record<string, Record<string, unknown>> = {};
  for (const [key, defaultValue] of Object.entries(defaultEndpointSpec)) {
    if (key === "cluster") continue;
    const catalogValue = catalogSpec?.[key];
    result[key] =
      catalogValue != null
        ? deepMerge(
            defaultValue as Record<string, unknown>,
            catalogValue as Record<string, unknown>,
          )
        : (defaultValue as Record<string, unknown>);
  }
  return result;
}

/** Default endpoint spec used for form initialization and catalog merge resets. */
export const defaultEndpointSpec = {
  cluster: "",
  model: {
    name: "",
    version: "",
    registry: "",
    file: "",
    task: "",
  },
  engine: {
    engine: "",
    version: "",
  },
  resources: {
    cpu: "0",
    memory: "0",
    gpu: "0",
    accelerator: null,
  },
  replicas: {
    num: 1,
  },
  deployment_options: {
    scheduler: {
      type: "consistent_hash",
    },
  },
  variables: {
    engine_args: {},
  },
  env: {},
} as const;
