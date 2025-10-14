import type { BaseStatus, Metadata } from "./basic-types";

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

export type EngineVersion = {
  version: string;
  values_schema: Record<string, string | number | boolean>;
};

export type EngineStatus = BaseStatus<EnginePhase>;

export enum EnginePhase {
  PENDING = "Pending",
  CREATED = "Created",
  FAILED = "Failed",
  DELETED = "Deleted",
}
