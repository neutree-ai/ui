import { normalizeVgpuVirtualization } from "@/domains/endpoint/lib/vgpu";
import type { ResourceSpec } from "@/foundation/types/serving-types";

const VGPU_MEMORY_MIB_KEY = "virtualization.memory_mib";
const VGPU_MEMORY_PERCENT_KEY = "virtualization.memory_percent";
const VGPU_CORE_PERCENT_KEY = "virtualization.core_percent";
const ALLOWED_ACCELERATOR_KEYS = new Set([
  "type",
  "product",
  VGPU_MEMORY_MIB_KEY,
  VGPU_CORE_PERCENT_KEY,
]);

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

  const normalized = { ...accelerator };
  const nestedVirtualization = isPlainRecord(normalized.virtualization)
    ? normalized.virtualization
    : {};
  const virtualization = normalizeVgpuVirtualization({
    memory_mib: normalized[VGPU_MEMORY_MIB_KEY],
    memory_percent: normalized[VGPU_MEMORY_PERCENT_KEY],
    core_percent: normalized[VGPU_CORE_PERCENT_KEY],
    ...nestedVirtualization,
  } as NonNullable<NonNullable<ResourceSpec["accelerator"]>["virtualization"]>);

  delete normalized[VGPU_MEMORY_MIB_KEY];
  delete normalized[VGPU_MEMORY_PERCENT_KEY];
  delete normalized[VGPU_CORE_PERCENT_KEY];

  if (virtualization) {
    normalized.virtualization = virtualization;
  } else {
    delete normalized.virtualization;
  }

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

const setFlatVgpuValue = (
  accelerator: Record<string, unknown>,
  key: string,
  value: unknown,
) => {
  if (value === null || value === undefined || value === "") return;
  accelerator[key] = String(value);
};

const parseOptionalValidationNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

/**
 * Whether an accelerator card count satisfies the precision rule for a cluster
 * type. A zero count is always allowed: the UI has no way to remove an
 * accidentally selected accelerator, so 0 acts as the "unselect" value and the
 * accelerator declaration is stripped on submit. SSH clusters additionally
 * allow one-decimal counts below one (0.1-0.9) and integers at or above one;
 * Kubernetes clusters allow integers only.
 */
const isGpuCountPrecisionValid = (
  gpu: number,
  clusterType: "ssh" | "kubernetes",
): boolean => {
  if (gpu === 0) {
    return true; // unselect: the accelerator declaration is removed on submit
  }

  if (gpu < 0) {
    return false;
  }

  if (clusterType === "kubernetes") {
    return Number.isInteger(gpu);
  }

  if (gpu >= 1) {
    return Number.isInteger(gpu);
  }

  // 0 < gpu < 1: exactly one decimal place.
  const scaled = gpu * 10;
  return Math.abs(scaled - Math.round(scaled)) < 1e-9;
};

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
 * Whether a requested resource amount over-allocates the target node/cluster.
 *
 * Only flags when capacity info is actually known (`total > 0`) and a positive
 * request exceeds what's available — so an unselected cluster (no data) or a
 * zero request never reports a false positive. `requestedTotal` is the request
 * summed across replicas; `available` is the max-available budget (which already
 * adds back the edited endpoint's own current usage).
 *
 * A small epsilon absorbs floating-point drift from the per-replica × count
 * arithmetic (the CPU field steps by 0.1, so e.g. `0.1 * 3` is
 * `0.30000000000000004`) — without it a request that exactly equals the
 * available budget would spuriously block deploy.
 */
const RESOURCE_REQUEST_EPSILON = 1e-6;

export function isResourceRequestExceeded(
  requestedTotal: number,
  available: number,
  total: number,
): boolean {
  return (
    total > 0 &&
    requestedTotal > 0 &&
    requestedTotal - available > RESOURCE_REQUEST_EPSILON
  );
}

/**
 * Transform endpoint spec values in-place before submission.
 * - Converts resource fields (cpu, memory, gpu) to strings for API compatibility
 * - Converts replicas.num from string (HTML input) to number
 */
export function transformEndpointValues(spec: {
  resources?: Record<string, unknown> | null;
  replicas?: { num?: unknown } | null;
  variables?: { engine_args?: Record<string, unknown> | null } | null;
}): void {
  if (spec.resources) {
    for (const field of ["cpu", "memory", "gpu"]) {
      const value = (spec.resources as Record<string, unknown>)[field];
      if (value != null) {
        (spec.resources as Record<string, unknown>)[field] = String(value);
      }
    }

    // A zero card count means "no accelerator": the UI has no way to remove an
    // accidentally selected accelerator, so 0 acts as the unselect value and
    // the accelerator declaration is stripped before submit. The backend
    // rejects a declared accelerator without a strictly positive count.
    if ((spec.resources as Record<string, unknown>).gpu === "0") {
      (spec.resources as Record<string, unknown>).accelerator = null;
    }

    const accelerator = spec.resources.accelerator as
      | (Record<string, unknown> & {
          virtualization?: Record<string, unknown> | null;
        })
      | null
      | undefined;
    if (accelerator) {
      const nestedVirtualization = isPlainRecord(accelerator.virtualization)
        ? accelerator.virtualization
        : {};
      const normalized = normalizeVgpuVirtualization({
        memory_mib: accelerator[VGPU_MEMORY_MIB_KEY],
        memory_percent: accelerator[VGPU_MEMORY_PERCENT_KEY],
        core_percent: accelerator[VGPU_CORE_PERCENT_KEY],
        ...nestedVirtualization,
      } as NonNullable<
        NonNullable<ResourceSpec["accelerator"]>["virtualization"]
      >);

      delete accelerator.virtualization;
      delete accelerator[VGPU_MEMORY_MIB_KEY];
      delete accelerator[VGPU_MEMORY_PERCENT_KEY];
      delete accelerator[VGPU_CORE_PERCENT_KEY];

      const hasVirtualMemory = normalized?.memory_mib !== undefined;

      if (normalized && hasVirtualMemory) {
        setFlatVgpuValue(
          accelerator,
          VGPU_MEMORY_MIB_KEY,
          normalized.memory_mib,
        );
        setFlatVgpuValue(
          accelerator,
          VGPU_CORE_PERCENT_KEY,
          normalized.core_percent,
        );
      }

      for (const [key, value] of Object.entries(accelerator)) {
        if (
          !ALLOWED_ACCELERATOR_KEYS.has(key) ||
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
  const engineArgs = spec.variables?.engine_args;
  if (
    engineArgs &&
    typeof engineArgs === "object" &&
    !Array.isArray(engineArgs)
  ) {
    for (const [key, value] of Object.entries(engineArgs)) {
      if (typeof value !== "string") continue;
      const trimmed = value.trim();
      if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) continue;
      try {
        const parsed = JSON.parse(trimmed);
        if (
          (typeof parsed === "object" && parsed !== null) ||
          Array.isArray(parsed)
        ) {
          engineArgs[key] = parsed;
        }
      } catch {
        // Preserve invalid JSON strings so custom no-schema args keep old behavior.
      }
    }
  }
}

/**
 * Validate endpoint spec values. Returns an errors map (empty = valid).
 */
export function validateEndpointValues(
  spec: {
    replicas?: { num?: number } | null;
    deployment_options?: { scheduler?: { type?: string } | null } | null;
    resources?: {
      gpu?: number | string | null;
      accelerator?: {
        type?: string;
        product?: string;
        virtualization?: {
          memory_mib?: number | null;
          memory_percent?: number | null;
          core_percent?: number | null;
        } | null;
      } | null;
    } | null;
  },
  context: {
    action: "create" | "edit";
    currentRegistry: string;
    currentModelName: string;
    /**
     * Registry models matching a search for the exact current model name.
     * `null` means the existence lookup hasn't resolved (loading/failed) —
     * in that case the containment check is skipped rather than blocking
     * submit on unknown data.
     */
    availableModelNames: string[] | null;
    /**
     * The registries visible in this workspace, or `null` while the listing has
     * not resolved. Same rule as above: no answer means no verdict.
     */
    availableRegistryNames: string[] | null;
    /**
     * The target cluster type ("ssh" or "kubernetes"). Determines the legal
     * accelerator card-count precision: SSH clusters allow 0 (unassigned),
     * one-decimal counts below one, and integers at or above one; Kubernetes
     * clusters allow positive integers only. When absent, cluster-specific
     * precision rules cannot be applied and the check is skipped.
     */
    clusterType?: "ssh" | "kubernetes";
  },
  t: (key: string, options?: Record<string, unknown>) => string,
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

  const accelerator = spec.resources?.accelerator;
  const hasAccelerator = Boolean(accelerator?.type && accelerator?.product);
  if (hasAccelerator && context.clusterType) {
    const gpuRaw = spec.resources?.gpu;
    if (gpuRaw !== undefined && gpuRaw !== null && gpuRaw !== "") {
      const gpu = Number(gpuRaw);
      if (
        Number.isFinite(gpu) &&
        !isGpuCountPrecisionValid(gpu, context.clusterType)
      ) {
        errors["spec.resources.gpu"] = {
          type: "manual",
          message: t(
            context.clusterType === "kubernetes"
              ? "endpoints.messages.gpuCountPrecisionK8s"
              : "endpoints.messages.gpuCountPrecisionSsh",
          ),
        };
      }
    }
  }

  const virtualization = spec.resources?.accelerator?.virtualization;
  const memoryMiB = parseOptionalValidationNumber(virtualization?.memory_mib);
  const corePercent = parseOptionalValidationNumber(
    virtualization?.core_percent,
  );

  if (
    memoryMiB !== undefined &&
    (!Number.isFinite(memoryMiB) || memoryMiB <= 0)
  ) {
    errors["spec.resources.accelerator.virtualization.memory_mib"] = {
      type: "manual",
      message: t("endpoints.messages.vgpuMemoryMiBPositive"),
    };
  }

  if (
    corePercent !== undefined &&
    (!Number.isFinite(corePercent) || corePercent < 0 || corePercent > 100)
  ) {
    errors["spec.resources.accelerator.virtualization.core_percent"] = {
      type: "manual",
      message: t("endpoints.messages.vgpuCorePercentRange"),
    };
  }

  // A catalog written elsewhere names the registry its author had. The picker
  // renders an unknown value as an empty box rather than as the name it holds,
  // so without this the field looks unfilled and the deploy fails server-side.
  if (
    context.action === "create" &&
    context.currentRegistry &&
    context.availableRegistryNames !== null &&
    !context.availableRegistryNames.includes(context.currentRegistry)
  ) {
    errors["spec.model.registry"] = {
      type: "manual",
      message: t("endpoints.messages.modelRegistryNotInWorkspace", {
        name: context.currentRegistry,
      }),
    };
  }

  if (
    context.action === "create" &&
    context.currentRegistry &&
    context.currentModelName &&
    context.availableModelNames !== null
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
    // Declared so that applying a catalog that states no model metadata clears
    // whatever the last one left behind. The merge only writes the keys the
    // default names, so without this the previous catalog's parameter count
    // stays on the form — and gets submitted — under the new model's name.
    info: null,
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
