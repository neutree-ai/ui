import type { BaseStatus, Metadata } from "./basic-types";

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
  url: string; // 'file://path/to/model' | 'https://huggingface.co' | 'nfs://path/to/model';
  credentials: string;
};

export type ModelRegistryStatus = BaseStatus<ModelRegistryPhase>;

export enum ModelRegistryPhase {
  PENDING = "Pending",
  CONNECTED = "Connected",
  FAILED = "Failed",
  DELETED = "Deleted",
}
