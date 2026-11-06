import type { Endpoint } from "@/domains/endpoint/types";
import { formatDisplayValue } from "./display-value";

type EndpointReviewChange = {
  step: number;
  label: string;
  before: unknown;
  after: unknown;
  format?: "cache";
};

type ReviewField = Omit<EndpointReviewChange, "before" | "after"> & {
  read: (endpoint: Endpoint) => unknown;
};

const reviewField = (
  step: number,
  label: string,
  read: ReviewField["read"],
  format?: ReviewField["format"],
): ReviewField => ({ step, label, read, format });

const numberValue = (value: unknown): unknown => {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
};

const cacheValue = (endpoint: Endpoint) => {
  const cache = endpoint.spec?.kv_cache;
  if (cache == null) return null;
  return {
    ...cache,
    options: cache.options
      ? {
          ...cache.options,
          timeout_seconds: numberValue(cache.options.timeout_seconds),
        }
      : cache.options,
  };
};

const fields: ReviewField[] = [
  reviewField(0, "endpoints.fields.replicas", (endpoint) =>
    numberValue(endpoint.spec?.replicas?.num),
  ),
  reviewField(
    0,
    "endpoints.fields.modelRegistry",
    (endpoint) => endpoint.spec?.model?.registry,
  ),
  reviewField(
    0,
    "endpoints.fields.modelName",
    (endpoint) => endpoint.spec?.model?.name,
  ),
  reviewField(
    0,
    "endpoints.fields.modelVersion",
    (endpoint) => endpoint.spec?.model?.version,
  ),
  reviewField(
    0,
    "endpoints.fields.modelFile",
    (endpoint) => endpoint.spec?.model?.file,
  ),
  reviewField(1, "common.fields.cluster", (endpoint) => endpoint.spec?.cluster),
  reviewField(1, "common.fields.cpu", (endpoint) =>
    numberValue(endpoint.spec?.resources?.cpu),
  ),
  reviewField(1, "common.fields.memory", (endpoint) =>
    numberValue(endpoint.spec?.resources?.memory),
  ),
  reviewField(1, "endpoints.fields.physicalGpu", (endpoint) =>
    numberValue(endpoint.spec?.resources?.gpu),
  ),
  reviewField(1, "endpoints.fields.accelerator", (endpoint) => {
    const accelerator = endpoint.spec?.resources?.accelerator;
    if (!accelerator?.type && !accelerator?.product) return null;
    return [accelerator?.type, accelerator?.product]
      .filter(Boolean)
      .join(" / ");
  }),
  reviewField(1, "endpoints.fields.vgpuMemory", (endpoint) =>
    numberValue(
      endpoint.spec?.resources?.accelerator?.virtualization?.memory_mib,
    ),
  ),
  reviewField(1, "endpoints.fields.vgpuCoreLimit", (endpoint) =>
    numberValue(
      endpoint.spec?.resources?.accelerator?.virtualization?.core_percent,
    ),
  ),
  reviewField(
    2,
    "endpoints.fields.taskType",
    (endpoint) => endpoint.spec?.model?.task,
  ),
  reviewField(
    2,
    "common.fields.engine",
    (endpoint) => endpoint.spec?.engine?.engine,
  ),
  reviewField(
    2,
    "endpoints.fields.engineVersion",
    (endpoint) => endpoint.spec?.engine?.version,
  ),
  reviewField(2, "endpoints.sections.kvCache", cacheValue, "cache"),
  reviewField(
    3,
    "endpoints.fields.schedulerType",
    (endpoint) => endpoint.spec?.deployment_options?.scheduler?.type,
  ),
  reviewField(
    3,
    "endpoints.fields.engineVariables",
    (endpoint) => endpoint.spec?.variables?.engine_args,
  ),
  reviewField(
    3,
    "endpoints.fields.environment",
    (endpoint) => endpoint.spec?.env,
  ),
];

const canonicalValue = (value: unknown): unknown => {
  if (value == null || value === "") return null;
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonicalValue(child)]),
  );
};

export const endpointValuesEqual = (left: unknown, right: unknown) =>
  JSON.stringify(canonicalValue(left)) ===
  JSON.stringify(canonicalValue(right));

/** Lists only editable endpoint fields whose persisted value changed. */
export function endpointReviewChanges(
  current: Endpoint,
  baseline: Endpoint,
): EndpointReviewChange[] {
  return fields.flatMap(({ read, ...field }) => {
    const before = read(baseline);
    const after = read(current);
    return endpointValuesEqual(before, after)
      ? []
      : [{ ...field, before, after }];
  });
}

export function formatEndpointReviewValue(
  value: unknown,
  format?: EndpointReviewChange["format"],
): string {
  if (format === "cache") {
    if (value == null) return "";
    const cache = value as {
      provider?: string;
      options?: { timeout_seconds?: number };
    };
    const timeout = cache.options?.timeout_seconds;
    return [cache.provider, timeout == null ? null : `${timeout}s`]
      .filter(Boolean)
      .join(" · ");
  }
  return formatDisplayValue(canonicalValue(value));
}
