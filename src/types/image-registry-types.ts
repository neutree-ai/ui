import type { BaseStatus, Metadata } from "./basic-types";

export type ImageRegistry = {
  id: number;
  api_version: "v1";
  kind: "ImageRegistry";
  metadata: Metadata;
  spec: ImageRegistrySpec;
  status: ImageRegistryStatus | null;
};

export type ImageRegistrySpec = {
  url: string;
  repository: string;
  authconfig: {
    username?: string;
    password?: string;
    auth?: string;
  };
  ca: string;
};

export type ImageRegistryStatus = BaseStatus<ImageRegistryPhase>;

export enum ImageRegistryPhase {
  PENDING = "Pending",
  CONNECTED = "Connected",
  FAILED = "Failed",
  DELETED = "Deleted",
}
