import { formatToDecimal } from "@/foundation/role/unit";
import type {
  EndpointSpec,
  ModelSpec,
  ReplicaSpec,
  ResourceSpec,
} from "../types";
import { DEFAULT_KV_CACHE_TIMEOUT_SECONDS } from "./endpoint-deploy-kv-cache";
import { engineRefLabel } from "./endpoint-display-model";
import { normalizeEndpointResourcesForForm } from "./endpoint-form-helpers";
import {
  getRoundedVgpuMemoryGiBValue,
  getVgpuMemoryDisplay,
  getVgpuVirtualization,
  hasVgpuResources,
} from "./vgpu";

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** One labelled summary value; an empty value shows the empty marker. */
export type SummaryRow = { label: string; value: string };

/** A stored replica count as shown; a missing one counts as one. */
export const replicaCount = (replicas: ReplicaSpec | null | undefined) =>
  replicas?.num ?? 1;

/** Replicas a form is about to request: at least one, whatever the input holds. */
export const requestedReplicas = (replicas: ReplicaSpec | null | undefined) =>
  Math.max(1, Number(replicas?.num ?? 1));

/** The KV cache timeout, the default when the endpoint sets none. */
export const kvCacheTimeoutSeconds = (kvCache: EndpointSpec["kv_cache"]) =>
  kvCache?.options?.timeout_seconds ?? DEFAULT_KV_CACHE_TIMEOUT_SECONDS;

/** An accelerator type's display name, the type itself when unnamed. */
export const acceleratorTypeLabel = (type: string, t: Translate) =>
  t(`clusters.acceleratorTypes.${type}`, { defaultValue: type });

const modelRows = (model: ModelSpec | null, t: Translate): SummaryRow[] => [
  { label: t("endpoints.fields.modelRegistry"), value: model?.registry ?? "" },
  { label: t("common.fields.model"), value: model?.name ?? "" },
  { label: t("common.fields.task"), value: model?.task ?? "" },
  {
    label: t("endpoints.fields.modelVersion"),
    value:
      model?.version ||
      t("endpoints.wizard.summary.versionResolvedAtDeployment"),
  },
  {
    label: t("endpoints.fields.modelFile"),
    value: model?.file || t("endpoints.wizard.summary.fileDefaultEntryPoint"),
  },
];

const resourceRows = (
  resources: ResourceSpec | null,
  t: Translate,
): SummaryRow[] => {
  const accelerator = resources?.accelerator;
  const vgpuMemoryGiB = getRoundedVgpuMemoryGiBValue(
    accelerator?.virtualization?.memory_mib,
  );
  const corePercent = accelerator?.virtualization?.core_percent;
  return [
    {
      label: t("endpoints.fields.accelerator"),
      value: accelerator?.product || accelerator?.type || "",
    },
    {
      label: t("endpoints.wizard.summary.resourceRequest"),
      value: t("endpoints.wizard.summary.resourcePerReplicaValue", {
        cpu: resources?.cpu ?? 0,
        memory: resources?.memory ?? 0,
        gpu: resources?.gpu ?? 0,
      }),
    },
    vgpuMemoryGiB != null && {
      label: t("endpoints.fields.singleCardMemory"),
      value: t("endpoints.wizard.summary.gibValue", { value: vgpuMemoryGiB }),
    },
    corePercent != null && {
      label: t("endpoints.fields.vgpuCoreLimit"),
      value: t("endpoints.wizard.summary.percentValue", { value: corePercent }),
    },
  ].filter((row): row is SummaryRow => Boolean(row));
};

/**
 * The review step's view of an endpoint spec: unset model version and file
 * name what deployment picks instead, and vGPU limits appear only when set.
 */
export function endpointConfigurationSummary(spec: EndpointSpec, t: Translate) {
  return {
    cluster: spec.cluster,
    replicas: requestedReplicas(spec.replicas),
    model: modelRows(spec.model, t),
    runtime: [
      { label: t("common.fields.engine"), value: engineRefLabel(spec.engine) },
      {
        label: t("endpoints.wizard.summary.cache"),
        value: spec.kv_cache
          ? t("endpoints.wizard.summary.cacheConfiguration", {
              provider: spec.kv_cache.provider,
              timeout: kvCacheTimeoutSeconds(spec.kv_cache),
            })
          : t("endpoints.wizard.summary.cacheDisabled"),
      },
    ] satisfies SummaryRow[],
    resources: resourceRows(spec.resources, t),
  };
}

/**
 * A requested resource block as shown on a card. The accelerator shows only
 * with both type and product, its vGPU limits only with a vGPU memory request.
 */
export function requestedResourcesView(resources: ResourceSpec | null) {
  const normalized = normalizeEndpointResourcesForForm(resources);
  const accelerator = normalized?.accelerator;
  const virtualization = getVgpuVirtualization(accelerator);
  return {
    gpu: formatToDecimal(normalized?.gpu),
    cpu: formatToDecimal(normalized?.cpu),
    memory: formatToDecimal(normalized?.memory),
    requestsGpu: Boolean(normalized?.gpu && normalized.gpu > 0),
    accelerator:
      accelerator?.type && accelerator.product
        ? { type: accelerator.type, product: accelerator.product }
        : null,
    vgpu: hasVgpuResources(normalized)
      ? {
          memory: getVgpuMemoryDisplay(virtualization, undefined),
          corePercent:
            virtualization?.core_percent !== undefined
              ? formatToDecimal(virtualization.core_percent, 0)
              : null,
        }
      : null,
  };
}
