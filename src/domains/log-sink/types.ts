import type { BaseStatus, Metadata } from "@/foundation/types/basic-types";

type LogSinkPhase =
  | "Pending"
  | "Running"
  | "Degraded"
  | "Failed"
  | "Disabled"
  | "Deleted";

export type LogSinkAuthType = "none" | "basic" | "bearer";

export type LogSinkAuth = {
  type: LogSinkAuthType;
  username?: string;
  // Never returned on read; omitted on update to keep the stored value.
  password?: string;
  token?: string;
};

export type VictoriaLogsSinkSpec = {
  url: string;
  ca_cert?: string;
  insecure_skip_verify?: boolean;
  timeout_seconds?: number;
  auth?: LogSinkAuth;
  extra_fields?: Record<string, string>;
};

export type LogSinkSpec = {
  type: "victorialogs";
  enabled?: boolean;
  victorialogs?: VictoriaLogsSinkSpec;
  buffer?: { max_size?: number } | null;
};

type LogSinkConnectionTest = {
  time: string;
  ok: boolean;
  message?: string;
};

export type LogSinkStatus = BaseStatus<LogSinkPhase> & {
  sent_events?: number;
  dropped_events?: number;
  last_sent_time?: string | null;
  last_connection_test?: LogSinkConnectionTest | null;
};

export type LogSink = {
  id: number;
  api_version: "v1";
  kind: "LogSink";
  metadata: Metadata;
  spec: LogSinkSpec;
  status: LogSinkStatus | null;
};
