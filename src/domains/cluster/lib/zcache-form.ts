import type { UseFormReturn } from "react-hook-form";
import { v4 as uuidv4 } from "uuid";
import type { Cluster, ZCacheSpec } from "../types";
import { cacheFailed, isValidCacheCapacity } from "./zcache-presentation";

const OPTIONS = "spec.cache.options";
const TARGET_NODES = "spec.cache.options.target_nodes";
const UPDATE = { shouldDirty: true, shouldValidate: true } as const;

/** The cache options as the form holds them; capacity is "" while cleared. */
type ZCacheDraft =
  | (Partial<Omit<ZCacheSpec, "l1_size_gib">> & { l1_size_gib?: unknown })
  | undefined;

/** The draft's settings, with capacity null while it is not a valid size. */
export function zcacheDraft(options: ZCacheDraft) {
  const enabled = options?.enabled === true;
  const selected = options?.target_nodes ?? [];
  const capacity = isValidCacheCapacity(options?.l1_size_gib)
    ? Number(options?.l1_size_gib)
    : null;
  const totalGiB = capacity == null ? null : capacity * selected.length;
  return { enabled, selected, capacity, totalGiB };
}

/**
 * Turns the cache on or off, completing the options so an enabled draft
 * always carries a capacity (1 GiB unless a valid one is typed) and nodes.
 */
export function setZCacheEnabled(form: UseFormReturn, enabled: boolean) {
  form.setValue("spec.cache.provider", "zcache", { shouldDirty: true });
  const options = form.getValues(OPTIONS);
  const { selected, capacity } = zcacheDraft(options);
  form.setValue(
    OPTIONS,
    { ...options, enabled, l1_size_gib: capacity ?? 1, target_nodes: selected },
    UPDATE,
  );
  form.setValue("spec.cache.options.enabled", enabled, UPDATE);
}

export function setZCacheTargetNode(
  form: UseFormReturn,
  selected: string[],
  node: string,
  checked: boolean,
) {
  form.setValue(
    TARGET_NODES,
    checked ? [...selected, node] : selected.filter((name) => name !== node),
    UPDATE,
  );
}

/** Registers the target nodes: an enabled cache needs at least one. */
export function registerZCacheTargetNodes(
  form: UseFormReturn,
  message: string,
) {
  return form.register(TARGET_NODES, {
    validate: (value?: string[]) =>
      form.getValues("spec.cache.options.enabled") !== true ||
      (value?.length ?? 0) > 0 ||
      message,
  });
}

export const zcacheTargetNodesInvalid = (form: UseFormReturn) =>
  !!form.getFieldState(TARGET_NODES, form.formState).error;

/** Cluster metadata with a fresh retry request for the cache controller. */
export const withCacheRetry = (metadata: Cluster["metadata"]) => ({
  ...metadata,
  annotations: {
    ...metadata.annotations,
    "neutree.ai/zcache-retry": uuidv4(),
  },
});

/**
 * The cache dialog's PATCH: the loaded spec with `cache` replaced by the
 * draft, an empty (masked) kubeconfig dropped so it does not overwrite the
 * stored one, and a retry request when the cache phase is Failed.
 */
export function zcacheSaveValues(cluster: Cluster, draft: ZCacheDraft) {
  const spec = structuredClone(cluster.spec);
  spec.cache = {
    provider: "zcache",
    options: {
      enabled: draft?.enabled === true,
      ...(draft?.version ? { version: draft.version } : {}),
      l1_size_gib: Number(draft?.l1_size_gib ?? 1),
      target_nodes: [...(draft?.target_nodes ?? [])],
    },
  };
  const kubernetes = spec.config.kubernetes_config;
  if (kubernetes && !kubernetes.kubeconfig) delete kubernetes.kubeconfig;
  return cacheFailed(cluster.status?.cache)
    ? { spec, metadata: withCacheRetry(cluster.metadata) }
    : { spec };
}
