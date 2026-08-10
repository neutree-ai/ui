import type { BaseStatus, Metadata } from "@/foundation/types/basic-types";

export type Engine = {
  id: number;
  api_version: "v1";
  kind: "Engine";
  metadata: Metadata;
  spec: EngineSpec;
  status: EngineStatus | null;
};

export type EngineSpec = {
  versions: EngineVersion[];
  supported_tasks: string[];
};

/**
 * Interaction surfaces the Playground can render. This is a separate vocabulary
 * from the model task: an engine can serve a chat-shaped playground without
 * advertising `text-generation` (document extraction engines such as MinerU),
 * which is why the tab must not be derived from the task alone.
 */
export type PlaygroundMode = "chat" | "embedding" | "rerank";

export type PlaygroundCapability = {
  enabled: boolean;
  /**
   * Interaction surfaces this engine version can serve. Absent or empty means
   * the engine does not narrow it down, and the surface is inferred from the
   * endpoint's model task as it was before engines could declare capabilities.
   */
  modes?: PlaygroundMode[];
};

export type MetricsExportCapability = {
  enabled: boolean;
  port?: number;
  path?: string;
};

/**
 * What an engine version declares it can do.
 *
 * Every field is optional, and an absent field means "undeclared", not
 * "unsupported". Engines registered before the capability protocol carry no
 * declaration at all and must keep working as they did, so never read these
 * fields directly — go through `resolvePlayground` in
 * `@/domains/engine/lib/resolve-capabilities`, which applies that fallback.
 */
export type EngineCapabilities = {
  metrics_export?: MetricsExportCapability;
  playground?: PlaygroundCapability;
};

export type EngineVersion = {
  version: string;
  values_schema: Record<string, string | number | boolean>;
  capabilities?: EngineCapabilities | null;
};

export type EngineStatus = BaseStatus<EnginePhase>;

enum EnginePhase {
  PENDING = "Pending",
  CREATED = "Created",
  FAILED = "Failed",
  DELETED = "Deleted",
}
