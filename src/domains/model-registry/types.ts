import type { BaseStatus, Metadata } from "@/foundation/types/basic-types";

export type ModelRegistry = {
  id: number;
  api_version: "v1";
  kind: "ModelRegistry";
  metadata: Metadata;
  spec: ModelRegistrySpec;
  status: ModelRegistryStatus | null;
};

export type ModelRegistrySpec = {
  type: string;
  url: string; // 'nfs://path/to/model' | 'https://huggingface.co'
  credentials?: string;
};

/**
 * A cached summary of what a registry holds, refreshed out of band by the
 * control plane rather than on read.
 *
 * The whole block is absent until the first measurement lands, and it stays
 * absent for a public registry, whose contents the control plane does not
 * measure at all. Absent is therefore "not counted", which is not the same
 * statement as a count of zero.
 */
type ModelRegistryStats = {
  model_count: number;
  storage_bytes: number;
  /** When the counters above were last refreshed (RFC3339). */
  stats_updated_at?: string;
};

export type ModelRegistryStatus = BaseStatus<ModelRegistryPhase> & {
  stats?: ModelRegistryStats | null;
};

/** Registries whose contents live somewhere the control plane can measure. A
 * public registry is not one of them. */
export const isPrivateModelRegistry = (spec?: ModelRegistrySpec | null) =>
  spec?.type === "bentoml";

enum ModelRegistryPhase {
  PENDING = "Pending",
  CONNECTED = "Connected",
  FAILED = "Failed",
  DELETED = "Deleted",
}
