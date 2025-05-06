import type { Metadata } from "./basic-types";

export type Workspace = {
  id: number;
  api_version: "v1";
  kind: "Workspace";
  metadata: Metadata;
};
