import {
  emptyLogSinkFormValues,
  type LogSinkFormValues,
} from "@/domains/log-sink/lib/log-sink-form";
import type { LogSink, LogSinkSpec } from "@/domains/log-sink/types";

type LogSinkOverrides = {
  name?: string;
  spec?: Partial<LogSinkSpec>;
  phase?: string;
  deleted?: boolean;
};

/**
 * A stored VictoriaLogs sink named "vl". `spec` fields replace the default
 * ones; `phase` sets the status (none when omitted).
 */
export function makeLogSink({
  name = "vl",
  spec,
  phase,
  deleted = false,
}: LogSinkOverrides = {}): LogSink {
  return {
    id: 1,
    api_version: "v1",
    kind: "LogSink",
    metadata: {
      name,
      creation_timestamp: "2026-01-01T00:00:00Z",
      deletion_timestamp: deleted ? "2026-01-02T00:00:00Z" : null,
    },
    spec: {
      type: "victorialogs",
      victorialogs: { url: "https://vl:9428" },
      ...spec,
    },
    status: phase ? { phase } : null,
  } as LogSink;
}

/**
 * Form values for a valid VictoriaLogs sink named "vl" with no auth; `patch`
 * mutates them before they are returned.
 */
export function makeLogSinkFormValues(
  patch: (values: LogSinkFormValues) => void = () => {},
): LogSinkFormValues {
  const values = emptyLogSinkFormValues();
  values.metadata.name = "vl";
  values.spec.victorialogs.url = "https://vl:9428";
  patch(values);
  return values;
}
