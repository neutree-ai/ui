import type { LogSink } from "@/domains/log-sink/types";
import { fixtureMetadata } from "@/foundation/testing/visual-fixtures";

function makeSink(
  name: string,
  spec: LogSink["spec"],
  status: LogSink["status"],
): LogSink {
  return {
    id: 1,
    api_version: "v1",
    kind: "LogSink",
    metadata: fixtureMetadata(name),
    spec,
    status,
  };
}

const GIB = 1024 ** 3;

/** A healthy VictoriaLogs sink with large counters and a timed passing test. */
export const healthySink = makeSink(
  "central-logs",
  {
    type: "victorialogs",
    enabled: true,
    victorialogs: {
      url: "https://logs.example.com:9428",
      auth: { type: "basic", username: "forwarder" },
      timeout_seconds: 30,
      extra_fields: { env: "prod", region: "region-a" },
    },
    buffer: { max_size: 2 * GIB },
  },
  {
    phase: "Running",
    last_transition_time: "2026-05-30T10:00:00Z",
    sent_events: 12345678,
    dropped_events: 1204,
    last_sent_time: "2026-06-01T11:59:00Z",
    last_connection_test: {
      time: "2026-06-01T11:00:00Z",
      ok: true,
      message: "connected",
    },
  },
);

/** A sink whose only test record has no time and failed with a long unbroken message. */
export const failingSink = makeSink(
  "backup-logs",
  {
    type: "victorialogs",
    enabled: true,
    victorialogs: {
      url: `https://${"very-long-hostname-".repeat(6)}example.com/insert/jsonline`,
      insecure_skip_verify: true,
    },
  },
  {
    phase: "Failed",
    error_message: "delivery failed",
    last_transition_time: "2026-05-31T22:00:00Z",
    last_connection_test: {
      ok: false,
      message: `dial tcp 10.0.0.12:9428: ${"connection-refused-".repeat(12)}`,
    },
  },
);

/** An S3 sink on the defaults, never tested, with no counters yet. */
export const s3Sink = makeSink(
  "archive-s3",
  {
    type: "s3",
    enabled: false,
    s3: { region: "region-a", bucket: "example-log-archive" },
  },
  { phase: "Disabled", last_transition_time: "2026-05-25T08:00:00Z" },
);
