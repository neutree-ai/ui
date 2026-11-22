import type { TFunction } from "i18next";
import { describe, expect, it } from "vitest";
import { makeLogSink } from "@/domains/log-sink/testing/builders";
import type { LogSink } from "@/domains/log-sink/types";
import {
  logSinkDeliveryFields,
  logSinkDestinationFields,
  logSinkHeaderFields,
} from "./detail-fields";

const t = ((key: string, values?: Record<string, unknown>) =>
  values ? `${key}:${Object.values(values).join(",")}` : key) as TFunction;

const keys = (fields: { label: string }[]) =>
  fields.map((item) => item.label.split(".").pop());

const shown = (
  fields: ReturnType<typeof logSinkDestinationFields>,
  sink: LogSink,
) =>
  Object.fromEntries(
    fields.flatMap(({ label, source }) =>
      typeof source === "function"
        ? [[label.split(".").pop(), source(sink, t)]]
        : [],
    ),
  );

const s3Sink = (s3: Partial<NonNullable<LogSink["spec"]["s3"]>> = {}) =>
  makeLogSink({
    spec: { type: "s3", s3: { region: "us-east-1", bucket: "logs", ...s3 } },
  });

describe("logSinkHeaderFields", () => {
  it.each([
    { enabled: undefined, shown: true },
    { enabled: false, shown: false },
  ])("reads enabled $enabled as $shown", ({ enabled, shown: expected }) => {
    const sink = makeLogSink({ spec: { enabled } });

    expect(shown(logSinkHeaderFields, sink).enabled).toBe(expected);
  });
});

describe("logSinkDestinationFields", () => {
  it("shows the username only for basic authentication", () => {
    const basic = makeLogSink({
      spec: {
        victorialogs: { url: "u", auth: { type: "basic", username: "ops" } },
      },
    });

    expect(keys(logSinkDestinationFields(makeLogSink()))).not.toContain(
      "username",
    );
    expect(shown(logSinkDestinationFields(basic), basic).username).toBe("ops");
  });

  it("marks omitted VictoriaLogs settings as defaults", () => {
    const sink = makeLogSink();

    expect(shown(logSinkDestinationFields(sink), sink)).toMatchObject({
      authType: "log_sinks.authTypes.none",
      insecureSkipVerify: false,
      caCert: "log_sinks.values.notSet",
      timeout: "log_sinks.values.timeoutDefault",
      bufferSizeShort: "log_sinks.values.bufferDefault",
      extraFields: undefined,
    });
  });

  it("marks omitted S3 settings as defaults", () => {
    const sink = s3Sink();

    expect(shown(logSinkDestinationFields(sink), sink)).toEqual({
      type: "log_sinks.types.s3",
      endpoint: "log_sinks.values.endpointDefault",
      region: "us-east-1",
      bucket: "logs",
      keyPrefix: "log_sinks.values.defaultSuffix:traces/%Y/%m/%d/",
      addressing: "log_sinks.values.defaultSuffix:log_sinks.values.pathStyle",
      compression: "log_sinks.values.defaultSuffix:log_sinks.compressions.gzip",
      flushInterval: "log_sinks.values.flushIntervalDefault",
      bufferSizeShort: "log_sinks.values.bufferDefault",
    });
  });

  it("shows stored S3 settings without the default mark", () => {
    const sink = s3Sink({
      endpoint: "https://s3.test",
      key_prefix: "audit/",
      force_path_style: false,
      compression: "zstd",
      flush_interval_seconds: 60,
    });
    sink.spec.buffer = { max_size: 2 * 1024 ** 3 };

    expect(shown(logSinkDestinationFields(sink), sink)).toMatchObject({
      endpoint: "https://s3.test",
      keyPrefix: "audit/",
      addressing: "log_sinks.values.virtualHosted",
      compression: "log_sinks.compressions.zstd",
      flushInterval: "log_sinks.values.timeoutSeconds:60",
      bufferSizeShort: "log_sinks.values.bufferGib:2",
    });
  });
});

describe("logSinkDeliveryFields", () => {
  it("reads absent counters as zero and omits the message", () => {
    const sink = makeLogSink({ phase: "Running" });
    const fields = logSinkDeliveryFields(sink);

    expect(shown(fields, sink)).toEqual({ sentEvents: 0, droppedEvents: 0 });
    expect(keys(fields)).not.toContain("message");
  });

  it("adds the last test message when there is one", () => {
    const sink = makeLogSink({ phase: "Failed" });
    if (sink.status) {
      sink.status.last_connection_test = { ok: false, message: "refused" };
    }

    expect(keys(logSinkDeliveryFields(sink))).toContain("message");
  });
});
