import type {
  LogSink,
  LogSinkAuth,
  LogSinkAuthType,
  LogSinkSpec,
  LogSinkType,
  S3Compression,
  S3SinkSpec,
  VictoriaLogsSinkSpec,
} from "@/domains/log-sink/types";

// Facts: src/domains/log-sink/data.md

const GIB = 1024 ** 3;
const MIN_BUFFER_BYTES = 268435488;

export const S3_DEFAULT_KEY_PREFIX = "traces/%Y/%m/%d/";
export const S3_DEFAULT_FLUSH_INTERVAL_SECONDS = 300;
const S3_MAX_FLUSH_INTERVAL_SECONDS = 86400;
const S3_MAX_KEY_PREFIX_LENGTH = 512;

export type ExtraFieldRow = { key: string; value: string };

/** Form shape. Paths match the stored spec wherever the meaning is the same. */
export type LogSinkFormValues = {
  api_version: "v1";
  kind: "LogSink";
  metadata: { name: string };
  spec: {
    type: LogSinkType;
    enabled: boolean;
    victorialogs: {
      url: string;
      ca_cert: string;
      insecure_skip_verify: boolean;
      timeout_seconds: string;
      auth: {
        type: LogSinkAuthType;
        username: string;
        password: string;
        token: string;
      };
      extra_fields: ExtraFieldRow[];
    };
    s3: {
      endpoint: string;
      region: string;
      bucket: string;
      key_prefix: string;
      force_path_style: boolean;
      compression: S3Compression;
      flush_interval_seconds: string;
      auth: { access_key_id: string; secret_access_key: string };
    };
    buffer: { max_size_gib: string };
  };
};

export const emptyLogSinkFormValues = (): LogSinkFormValues => ({
  api_version: "v1",
  kind: "LogSink",
  metadata: { name: "" },
  spec: {
    type: "victorialogs",
    enabled: true,
    victorialogs: {
      url: "",
      ca_cert: "",
      insecure_skip_verify: false,
      timeout_seconds: "",
      auth: { type: "none", username: "", password: "", token: "" },
      extra_fields: [],
    },
    s3: {
      endpoint: "",
      region: "",
      bucket: "",
      key_prefix: "",
      force_path_style: true,
      compression: "gzip",
      flush_interval_seconds: "",
      auth: { access_key_id: "", secret_access_key: "" },
    },
    buffer: { max_size_gib: "" },
  },
});

export const bytesToGib = (bytes: number): number => bytes / GIB;

/** Blank → undefined (backend default). Not a number → NaN, for the validator to reject. */
export const gibToBytes = (gib: string): number | undefined => {
  const trimmed = gib.trim();
  if (!trimmed) return undefined;
  const value = Number(trimmed);
  return Number.isFinite(value) ? Math.round(value * GIB) : Number.NaN;
};

const toAuthType = (type: string | undefined): LogSinkAuthType =>
  type === "basic" || type === "bearer" ? type : "none";

const toCompression = (value: string | undefined): S3Compression =>
  value === "zstd" || value === "none" ? value : "gzip";

export function toLogSinkFormValues(record: LogSink): LogSinkFormValues {
  const base = emptyLogSinkFormValues();
  const vl = record.spec?.victorialogs;
  const s3 = record.spec?.s3;
  const authType = toAuthType(vl?.auth?.type);
  const maxSize = record.spec?.buffer?.max_size;

  return {
    ...base,
    metadata: { name: record.metadata?.name ?? "" },
    spec: {
      type: record.spec?.type === "s3" ? "s3" : "victorialogs",
      enabled: record.spec?.enabled ?? true,
      victorialogs: {
        url: vl?.url ?? "",
        ca_cert: vl?.ca_cert ?? "",
        insecure_skip_verify: vl?.insecure_skip_verify ?? false,
        timeout_seconds: vl?.timeout_seconds ? String(vl.timeout_seconds) : "",
        auth: {
          type: authType,
          username: authType === "basic" ? (vl?.auth?.username ?? "") : "",
          password: "",
          token: "",
        },
        extra_fields: Object.entries(vl?.extra_fields ?? {}).map(
          ([key, value]) => ({ key, value }),
        ),
      },
      s3: {
        endpoint: s3?.endpoint ?? "",
        region: s3?.region ?? "",
        bucket: s3?.bucket ?? "",
        key_prefix: s3?.key_prefix ?? "",
        force_path_style: s3?.force_path_style ?? true,
        compression: toCompression(s3?.compression),
        flush_interval_seconds: s3?.flush_interval_seconds
          ? String(s3.flush_interval_seconds)
          : "",
        // Keys are masked on read; blank means "keep the stored key".
        auth: { access_key_id: "", secret_access_key: "" },
      },
      buffer: { max_size_gib: maxSize ? String(bytesToGib(maxSize)) : "" },
    },
  };
}

const isBlankRow = (row: ExtraFieldRow) => !row.key && !row.value;

function toS3SinkSpec(form: LogSinkFormValues["spec"]["s3"]): S3SinkSpec {
  const s3: S3SinkSpec = {
    region: form.region.trim(),
    bucket: form.bucket.trim(),
  };
  if (form.endpoint.trim()) s3.endpoint = form.endpoint.trim();
  if (form.key_prefix) s3.key_prefix = form.key_prefix;
  if (!form.force_path_style) s3.force_path_style = false;
  if (form.compression !== "gzip") s3.compression = form.compression;
  const flush = Number(form.flush_interval_seconds.trim() || 0);
  if (flush) s3.flush_interval_seconds = flush;

  // Blank keys are left out so the API keeps the stored ones.
  const auth: NonNullable<S3SinkSpec["auth"]> = {};
  if (form.auth.access_key_id.trim()) {
    auth.access_key_id = form.auth.access_key_id.trim();
  }
  if (form.auth.secret_access_key) {
    auth.secret_access_key = form.auth.secret_access_key;
  }
  if (Object.keys(auth).length) s3.auth = auth;
  return s3;
}

function toVictoriaLogsSinkSpec(
  form: LogSinkFormValues["spec"]["victorialogs"],
): VictoriaLogsSinkSpec {
  const vl: VictoriaLogsSinkSpec = { url: form.url.trim() };

  if (form.ca_cert.trim()) vl.ca_cert = form.ca_cert;
  if (form.insecure_skip_verify) vl.insecure_skip_verify = true;
  const timeout = Number(form.timeout_seconds.trim() || 0);
  if (timeout > 0) vl.timeout_seconds = timeout;

  const auth = form.auth;
  if (auth.type === "basic") {
    const basic: LogSinkAuth = { type: "basic", username: auth.username };
    // Blank = keep the stored password (backfilled by the API).
    if (auth.password) basic.password = auth.password;
    vl.auth = basic;
  } else if (auth.type === "bearer") {
    const bearer: LogSinkAuth = { type: "bearer" };
    if (auth.token) bearer.token = auth.token;
    vl.auth = bearer;
  }

  const rows = form.extra_fields.filter((row) => !isBlankRow(row));
  if (rows.length) {
    vl.extra_fields = Object.fromEntries(
      rows.map((row) => [row.key, row.value]),
    );
  }

  return vl;
}

/** The whole spec: PATCH replaces it, so every kept value must be sent. */
export function toLogSinkSpec(values: LogSinkFormValues): LogSinkSpec {
  // Only the chosen type's settings are sent (the server drops the other's).
  const spec: LogSinkSpec =
    values.spec.type === "s3"
      ? {
          type: "s3",
          enabled: values.spec.enabled,
          s3: toS3SinkSpec(values.spec.s3),
        }
      : {
          type: "victorialogs",
          enabled: values.spec.enabled,
          victorialogs: toVictoriaLogsSinkSpec(values.spec.victorialogs),
        };
  const maxSize = gibToBytes(values.spec.buffer.max_size_gib);
  if (maxSize !== undefined) spec.buffer = { max_size: maxSize };
  return spec;
}

/** Create sends the full object; edit sends only spec (PATCH replaces metadata whole). */
export function toLogSinkPayload(
  values: LogSinkFormValues,
  action: "create" | "edit",
): Partial<LogSink> {
  const spec = toLogSinkSpec(values);
  if (action === "edit") return { spec };
  return {
    api_version: "v1",
    kind: "LogSink",
    metadata: { name: values.metadata.name.trim() } as LogSink["metadata"],
    spec,
  };
}

// ---------------------------------------------------------------------------
// Validation. Each returns an error kind, or undefined when valid.
// ---------------------------------------------------------------------------

export const NAME_PATTERN = /^[a-z0-9]([-a-z0-9.]*[a-z0-9])?$/;

type UrlError = "required" | "invalid" | "scheme" | "host" | "queryOrFragment";

export function validateSinkUrl(url: string): UrlError | undefined {
  const value = url.trim();
  if (!value) return "required";
  if (!/^https?:\/\//i.test(value)) return "scheme";
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return "invalid";
  }
  if (!parsed.host) return "host";
  if (parsed.search || parsed.hash) return "queryOrFragment";
  return undefined;
}

type S3EndpointError = "scheme" | "invalid" | "host" | "extraParts";

/** Optional; the controller's rules (the API only checks the scheme). */
export function validateS3Endpoint(url: string): S3EndpointError | undefined {
  const value = url.trim();
  if (!value) return undefined;
  if (!/^https?:\/\//i.test(value)) return "scheme";
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return "invalid";
  }
  if (!parsed.host) return "host";
  if (parsed.search || parsed.hash || parsed.username || parsed.password) {
    return "extraParts";
  }
  return undefined;
}

type KeyPrefixError = "tooLong" | "leadingSlash" | "template" | "invalidChars";

/** Controller-only rules; the API accepts any string. */
export function validateKeyPrefix(prefix: string): KeyPrefixError | undefined {
  if (prefix.length > S3_MAX_KEY_PREFIX_LENGTH) return "tooLong";
  if (prefix.startsWith("/")) return "leadingSlash";
  if (prefix.includes("{{") || prefix.includes("}}")) return "template";
  // biome-ignore lint/suspicious/noControlCharactersInRegex: matching control characters is the point
  if (/[\u0000-\u001f\u007f\\]/.test(prefix)) return "invalidChars";
  return undefined;
}

export function validateFlushInterval(value: string): "invalid" | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (!/^\d+$/.test(trimmed)) return "invalid";
  const seconds = Number(trimmed);
  return seconds >= 1 && seconds <= S3_MAX_FLUSH_INTERVAL_SECONDS
    ? undefined
    : "invalid";
}

export function validateBufferGib(gib: string): "invalid" | "min" | undefined {
  const bytes = gibToBytes(gib);
  if (bytes === undefined) return undefined;
  if (Number.isNaN(bytes) || bytes <= 0) return "invalid";
  if (bytes < MIN_BUFFER_BYTES) return "min";
  return undefined;
}

export function validateTimeoutSeconds(value: string): "invalid" | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return /^\d+$/.test(trimmed) ? undefined : "invalid";
}

type ExtraFieldKeyError = "required" | "invalidChars" | "duplicate";

export function validateExtraFieldKey(
  rows: ExtraFieldRow[],
  index: number,
): ExtraFieldKeyError | undefined {
  const row = rows[index];
  if (!row || isBlankRow(row)) return undefined;
  if (!row.key) return "required";
  if (/[,=]/.test(row.key)) return "invalidChars";
  if (rows.findIndex((other) => other.key === row.key) !== index) {
    return "duplicate";
  }
  return undefined;
}

export function validateExtraFieldValue(value: string): "comma" | undefined {
  return value.includes(",") ? "comma" : undefined;
}

/** Server error codes (migration 104) → form field. */
export const LOG_SINK_ERROR_FIELDS: Record<string, string> = {
  "10243": "spec.type",
  "10244": "spec.victorialogs.url",
  "10245": "spec.victorialogs.url",
  "10246": "spec.victorialogs.auth.type",
  "10247": "spec.victorialogs.auth.username",
  "10248": "spec.victorialogs.auth.token",
  "10249": "spec.buffer.max_size_gib",
  // Shape errors the form cannot produce; shown on the type.
  "10305": "spec.type",
  "10306": "spec.s3.bucket",
  "10307": "spec.s3.region",
  "10308": "spec.s3.endpoint",
  "10309": "spec.s3.compression",
  "10310": "spec.s3.flush_interval_seconds",
  "10311": "spec.s3.auth.access_key_id",
};
