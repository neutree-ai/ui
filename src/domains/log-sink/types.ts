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

export type LogSinkType = "victorialogs" | "s3";

export type S3Compression = "gzip" | "zstd" | "none";

export type S3SinkSpec = {
  endpoint?: string;
  region: string;
  bucket: string;
  key_prefix?: string;
  force_path_style?: boolean;
  compression?: S3Compression;
  flush_interval_seconds?: number;
  // Masked on read (returned as {}); a blank or omitted key keeps the stored one.
  auth?: { access_key_id?: string; secret_access_key?: string };
};

export type LogSinkSpec = {
  type: LogSinkType;
  enabled?: boolean;
  victorialogs?: VictoriaLogsSinkSpec | null;
  s3?: S3SinkSpec | null;
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
