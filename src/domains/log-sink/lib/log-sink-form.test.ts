import { describe, expect, it } from "vitest";
import type { LogSink } from "@/domains/log-sink/types";
import {
  bytesToGib,
  emptyLogSinkFormValues,
  gibToBytes,
  LOG_SINK_ERROR_FIELDS,
  type LogSinkFormValues,
  toLogSinkFormValues,
  toLogSinkPayload,
  toLogSinkSpec,
  validateBufferGib,
  validateExtraFieldKey,
  validateExtraFieldValue,
  validateFlushInterval,
  validateKeyPrefix,
  validateS3Endpoint,
  validateSinkUrl,
  validateTimeoutSeconds,
} from "./log-sink-form";

const record = (spec: LogSink["spec"]): LogSink =>
  ({
    id: 1,
    api_version: "v1",
    kind: "LogSink",
    metadata: { name: "vl", creation_timestamp: "2026-01-01" },
    spec,
    status: null,
  }) as LogSink;

const withForm = (
  patch: (values: LogSinkFormValues) => void,
): LogSinkFormValues => {
  const values = emptyLogSinkFormValues();
  values.metadata.name = "vl";
  values.spec.victorialogs.url = "https://vl.example.com:9428";
  patch(values);
  return values;
};

describe("GiB <-> bytes", () => {
  it("treats blank as unset", () => {
    expect(gibToBytes("")).toBeUndefined();
    expect(gibToBytes("  ")).toBeUndefined();
  });

  it("converts decimals to whole bytes", () => {
    expect(gibToBytes("1")).toBe(1073741824);
    expect(gibToBytes("1.5")).toBe(1610612736);
  });

  it("returns NaN for non-numbers", () => {
    expect(gibToBytes("abc")).toBeNaN();
  });

  it.each([268435488, 1073741824, 1610612736, 5000000000, 123456789012])(
    "round-trips %d bytes through the form text",
    (bytes) => {
      expect(gibToBytes(String(bytesToGib(bytes)))).toBe(bytes);
    },
  );
});

describe("toLogSinkSpec", () => {
  it("builds a minimal spec with no auth and no optional fields", () => {
    expect(toLogSinkSpec(withForm(() => {}))).toEqual({
      type: "victorialogs",
      enabled: true,
      victorialogs: { url: "https://vl.example.com:9428" },
    });
  });

  it("builds basic auth with password", () => {
    const spec = toLogSinkSpec(
      withForm((v) => {
        v.spec.victorialogs.auth = {
          type: "basic",
          username: "u",
          password: "p",
          token: "stale",
        };
      }),
    );
    expect(spec.victorialogs?.auth).toEqual({
      type: "basic",
      username: "u",
      password: "p",
    });
  });

  it("builds bearer auth with token only", () => {
    const spec = toLogSinkSpec(
      withForm((v) => {
        v.spec.victorialogs.auth = {
          type: "bearer",
          username: "stale",
          password: "stale",
          token: "t",
        };
      }),
    );
    expect(spec.victorialogs?.auth).toEqual({ type: "bearer", token: "t" });
  });

  it("omits auth for none", () => {
    const spec = toLogSinkSpec(
      withForm((v) => {
        v.spec.victorialogs.auth.type = "none";
        v.spec.victorialogs.auth.token = "stale";
      }),
    );
    expect(spec.victorialogs).not.toHaveProperty("auth");
  });

  it("omits blank secrets so the API keeps the stored ones", () => {
    const basic = toLogSinkSpec(
      withForm((v) => {
        v.spec.victorialogs.auth.type = "basic";
        v.spec.victorialogs.auth.username = "u";
      }),
    );
    expect(basic.victorialogs?.auth).toEqual({ type: "basic", username: "u" });

    const bearer = toLogSinkSpec(
      withForm((v) => {
        v.spec.victorialogs.auth.type = "bearer";
      }),
    );
    expect(bearer.victorialogs?.auth).toEqual({ type: "bearer" });
  });

  it("writes advanced fields only when set", () => {
    const spec = toLogSinkSpec(
      withForm((v) => {
        v.spec.enabled = false;
        v.spec.victorialogs.ca_cert = "PEM";
        v.spec.victorialogs.insecure_skip_verify = true;
        v.spec.victorialogs.timeout_seconds = "30";
        v.spec.victorialogs.extra_fields = [
          { key: "env", value: "prod" },
          { key: "", value: "" },
        ];
        v.spec.buffer.max_size_gib = "2";
      }),
    );
    expect(spec).toEqual({
      type: "victorialogs",
      enabled: false,
      victorialogs: {
        url: "https://vl.example.com:9428",
        ca_cert: "PEM",
        insecure_skip_verify: true,
        timeout_seconds: 30,
        extra_fields: { env: "prod" },
      },
      buffer: { max_size: 2147483648 },
    });
  });
});

describe("toLogSinkPayload", () => {
  it("sends the whole object on create", () => {
    const payload = toLogSinkPayload(
      withForm(() => {}),
      "create",
    );
    expect(payload).toMatchObject({
      api_version: "v1",
      kind: "LogSink",
      metadata: { name: "vl" },
    });
  });

  it("sends only spec on edit", () => {
    const payload = toLogSinkPayload(
      withForm(() => {}),
      "edit",
    );
    expect(Object.keys(payload)).toEqual(["spec"]);
  });
});

describe("reopen: stored -> form -> stored is unchanged", () => {
  it.each<[string, LogSink["spec"]]>([
    [
      "basic with everything",
      {
        type: "victorialogs",
        enabled: true,
        victorialogs: {
          url: "https://vl.example.com:9428",
          ca_cert: "PEM",
          insecure_skip_verify: true,
          timeout_seconds: 15,
          auth: { type: "basic", username: "u" },
          extra_fields: { a: "1", b: "2" },
        },
        buffer: { max_size: 268435488 },
      },
    ],
    [
      "bearer, disabled",
      {
        type: "victorialogs",
        enabled: false,
        victorialogs: {
          url: "http://vl:9428",
          auth: { type: "bearer" },
        },
      },
    ],
    [
      "no auth",
      {
        type: "victorialogs",
        enabled: true,
        victorialogs: { url: "http://vl:9428" },
      },
    ],
  ])("%s", (_, spec) => {
    expect(toLogSinkSpec(toLogSinkFormValues(record(spec)))).toEqual(spec);
  });

  it("opens the edit form with blank secrets", () => {
    const values = toLogSinkFormValues(
      record({
        type: "victorialogs",
        enabled: true,
        victorialogs: {
          url: "http://vl:9428",
          auth: { type: "basic", username: "u" },
        },
      }),
    );
    expect(values.spec.victorialogs.auth).toEqual({
      type: "basic",
      username: "u",
      password: "",
      token: "",
    });
  });
});

describe("validation", () => {
  it.each([
    ["", "required"],
    ["vl.example.com", "scheme"],
    ["ftp://vl", "scheme"],
    ["http://", "invalid"],
    ["https://vl:9428?x=1", "queryOrFragment"],
    ["https://vl:9428/#frag", "queryOrFragment"],
    ["https://vl.example.com:9428", undefined],
  ])("url %j -> %s", (url, error) => {
    expect(validateSinkUrl(url)).toBe(error);
  });

  it("checks buffer size", () => {
    expect(validateBufferGib("")).toBeUndefined();
    expect(validateBufferGib("x")).toBe("invalid");
    expect(validateBufferGib("-1")).toBe("invalid");
    expect(validateBufferGib("0.25")).toBe("min");
    expect(validateBufferGib(String(bytesToGib(268435488)))).toBeUndefined();
  });

  it("checks timeout", () => {
    expect(validateTimeoutSeconds("")).toBeUndefined();
    expect(validateTimeoutSeconds("30")).toBeUndefined();
    expect(validateTimeoutSeconds("-1")).toBe("invalid");
    expect(validateTimeoutSeconds("1.5")).toBe("invalid");
  });

  it("checks extra field keys and values", () => {
    const rows = [
      { key: "a", value: "1" },
      { key: "", value: "x" },
      { key: "b=c", value: "" },
      { key: "a", value: "2" },
      { key: "", value: "" },
    ];
    expect(validateExtraFieldKey(rows, 0)).toBeUndefined();
    expect(validateExtraFieldKey(rows, 1)).toBe("required");
    expect(validateExtraFieldKey(rows, 2)).toBe("invalidChars");
    expect(validateExtraFieldKey(rows, 3)).toBe("duplicate");
    expect(validateExtraFieldKey(rows, 4)).toBeUndefined();
    expect(validateExtraFieldValue("a,b")).toBe("comma");
    expect(validateExtraFieldValue("ab")).toBeUndefined();
  });
});

const withS3Form = (
  patch: (values: LogSinkFormValues) => void,
): LogSinkFormValues =>
  withForm((v) => {
    v.spec.type = "s3";
    v.spec.s3.region = "us-east-1";
    v.spec.s3.bucket = "traces";
    v.spec.s3.auth = { access_key_id: "ak", secret_access_key: "sk" };
    patch(v);
  });

describe("s3", () => {
  it("sends only the s3 sub-object, defaults omitted", () => {
    expect(toLogSinkSpec(withS3Form(() => {}))).toEqual({
      type: "s3",
      enabled: true,
      s3: {
        region: "us-east-1",
        bucket: "traces",
        auth: { access_key_id: "ak", secret_access_key: "sk" },
      },
    });
  });

  it("writes non-default values", () => {
    const spec = toLogSinkSpec(
      withS3Form((v) => {
        v.spec.s3.endpoint = " http://minio:9000 ";
        v.spec.s3.key_prefix = "logs/%Y/";
        v.spec.s3.force_path_style = false;
        v.spec.s3.compression = "zstd";
        v.spec.s3.flush_interval_seconds = "10";
        v.spec.buffer.max_size_gib = "2";
      }),
    );
    expect(spec).toEqual({
      type: "s3",
      enabled: true,
      s3: {
        endpoint: "http://minio:9000",
        region: "us-east-1",
        bucket: "traces",
        key_prefix: "logs/%Y/",
        force_path_style: false,
        compression: "zstd",
        flush_interval_seconds: 10,
        auth: { access_key_id: "ak", secret_access_key: "sk" },
      },
      buffer: { max_size: 2147483648 },
    });
  });

  it("omits blank keys on edit, each one alone, and auth when both are blank", () => {
    const onlySecret = toLogSinkSpec(
      withS3Form((v) => {
        v.spec.s3.auth = { access_key_id: "", secret_access_key: "new" };
      }),
    );
    expect(onlySecret.s3?.auth).toEqual({ secret_access_key: "new" });

    const none = toLogSinkSpec(
      withS3Form((v) => {
        v.spec.s3.auth = { access_key_id: " ", secret_access_key: "" };
      }),
    );
    expect(none.s3).not.toHaveProperty("auth");
  });

  it("victorialogs spec carries no s3 settings even when the s3 inputs were filled", () => {
    const values = withS3Form(() => {});
    values.spec.type = "victorialogs";
    expect(toLogSinkSpec(values)).not.toHaveProperty("s3");
  });

  it("s3 spec carries no victorialogs settings", () => {
    expect(toLogSinkSpec(withS3Form(() => {}))).not.toHaveProperty(
      "victorialogs",
    );
  });

  it.each<[string, NonNullable<LogSink["spec"]["s3"]>]>([
    ["defaults", { region: "us-east-1", bucket: "traces" }],
    [
      "everything set",
      {
        endpoint: "http://minio:9000",
        region: "eu-west-1",
        bucket: "traces",
        key_prefix: "a/%Y/",
        force_path_style: false,
        compression: "none",
        flush_interval_seconds: 86400,
      },
    ],
  ])("reopen round-trip: %s (keys masked as {})", (_, stored) => {
    const read = record({
      type: "s3",
      enabled: false,
      s3: { ...stored, auth: {} },
      buffer: { max_size: 268435488 },
    });
    const values = toLogSinkFormValues(read);
    expect(values.spec.type).toBe("s3");
    expect(values.spec.s3.auth).toEqual({
      access_key_id: "",
      secret_access_key: "",
    });
    // Blank keys are omitted, so the PATCH keeps the stored ones.
    expect(toLogSinkSpec(values)).toEqual({
      type: "s3",
      enabled: false,
      s3: stored,
      buffer: { max_size: 268435488 },
    });
  });

  it("opens absent path style as on and absent compression as gzip", () => {
    const values = toLogSinkFormValues(
      record({ type: "s3", s3: { region: "r", bucket: "b", auth: {} } }),
    );
    expect(values.spec.s3.force_path_style).toBe(true);
    expect(values.spec.s3.compression).toBe("gzip");
    expect(values.spec.s3.flush_interval_seconds).toBe("");
  });

  it.each([
    ["", undefined],
    ["http://minio:9000", undefined],
    ["https://s3.amazonaws.com", undefined],
    ["minio:9000", "scheme"],
    ["http://", "invalid"],
    ["http://u:p@minio:9000", "extraParts"],
    ["http://minio:9000?x=1", "extraParts"],
  ])("endpoint %j -> %s", (url, error) => {
    expect(validateS3Endpoint(url)).toBe(error);
  });

  it.each([
    ["", undefined],
    ["traces/%Y/%m/%d/", undefined],
    ["x".repeat(513), "tooLong"],
    ["/abs", "leadingSlash"],
    ["a/{{ field }}/", "template"],
    ["a\\b", "invalidChars"],
    ["a\nb", "invalidChars"],
  ])("key prefix %j -> %s", (prefix, error) => {
    expect(validateKeyPrefix(prefix)).toBe(error);
  });

  it.each([
    ["", undefined],
    ["1", undefined],
    ["86400", undefined],
    ["0", "invalid"],
    ["86401", "invalid"],
    ["1.5", "invalid"],
    ["x", "invalid"],
  ])("flush interval %j -> %s", (value, error) => {
    expect(validateFlushInterval(value)).toBe(error);
  });

  it("maps s3 error codes to fields", () => {
    expect(
      ["10305", "10306", "10307", "10308", "10309", "10310", "10311"].map(
        (code) => LOG_SINK_ERROR_FIELDS[code],
      ),
    ).toEqual([
      "spec.type",
      "spec.s3.bucket",
      "spec.s3.region",
      "spec.s3.endpoint",
      "spec.s3.compression",
      "spec.s3.flush_interval_seconds",
      "spec.s3.auth.access_key_id",
    ]);
  });
});
