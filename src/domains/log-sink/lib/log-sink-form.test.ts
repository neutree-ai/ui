import { describe, expect, it } from "vitest";
import type { LogSink } from "@/domains/log-sink/types";
import {
  bytesToGib,
  emptyLogSinkFormValues,
  gibToBytes,
  type LogSinkFormValues,
  toLogSinkFormValues,
  toLogSinkPayload,
  toLogSinkSpec,
  validateBufferGib,
  validateExtraFieldKey,
  validateExtraFieldValue,
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
