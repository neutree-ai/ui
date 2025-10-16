import type { Metadata } from "./basic-types";

type LicenseInfo = {
  edition: string;
  vendor: string;
  sign_date: number;
  license_type: string;
  period: number;
  max_gpus: number;
  serial: string;
};

type LicenseUsage = {
  GPU?: {
    used: number;
    limit: number;
    details: Record<string, number>;
  };
  Workspace?: {
    used: number;
    limit: number;
  };
};

type LicenseStatus = {
  last_transition_time: string;
  phase: string;
  info: LicenseInfo;
  usage: LicenseUsage;
};

export type License = Metadata & {
  id: number;
  api_version: "v1";
  kind: "License";
  metadata: Metadata;
  spec: {
    code: string;
  };
  status: LicenseStatus | null;
};
