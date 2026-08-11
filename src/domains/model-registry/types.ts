import type { ModelRegistryVisibility } from "@/foundation/lib/model-registry-visibility";
import type { BaseStatus, Metadata } from "@/foundation/types/basic-types";

export type ModelRegistry = {
  id: number;
  api_version: "v1";
  kind: "ModelRegistry";
  metadata: Metadata;
  spec: ModelRegistrySpec;
  status: ModelRegistryStatus | null;
  /**
   * Whether the registry holds its own contents or browses somebody else's.
   *
   * Stated by the server as a computed field, and optional here because it only
   * arrives when a request asks for it — see MODEL_REGISTRY_SELECT in
   * `@/foundation/lib/model-registry-visibility`, which is also where the rules
   * that read this value live.
   */
  visibility?: ModelRegistryVisibility;
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
  /**
   * When the control plane last checked whether the registry answers.
   *
   * Not the same fact as `last_transition_time`, which only moves when the
   * phase changes: a registry that has been reachable for three days still
   * reports the moment it first connected. "Last checked" is this one.
   */
  last_checked_at?: string | null;
};

/** Every phase the control plane reports for a registry. Not exported: it exists
 * to type `status.phase`, and the two phases the UI branches on are compared as
 * literals in `lib/capabilities` so that a typo is a type error there. */
type ModelRegistryPhase = "Pending" | "Connected" | "Failed" | "Deleted";
