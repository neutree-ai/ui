import type { TFunction } from "i18next";
import {
  bytesToGib,
  isLogSinkEnabled,
  S3_DEFAULT_COMPRESSION,
  S3_DEFAULT_FORCE_PATH_STYLE,
  S3_DEFAULT_KEY_PREFIX,
  toAuthType,
} from "@/domains/log-sink/lib/log-sink-form";
import type { LogSink } from "@/domains/log-sink/types";
import { ConnectionTestResult } from "@/foundation/role/ConnectionTestResult";
import Timestamp from "@/foundation/role/Timestamp";
import { type DetailField, field } from "@/foundation/scene/detail-field";

type Field = DetailField<LogSink>;

const s3 = (sink: LogSink) => sink.spec?.s3;
const vl = (sink: LogSink) => sink.spec?.victorialogs;
const lastTest = (sink: LogSink) => sink.status?.last_connection_test;
const lastMessage = (sink: LogSink) => lastTest(sink)?.message;

/** `label` as stored, or marked as the default when the API omits it. */
const withDefault = (stored: unknown, label: string, t: TFunction) =>
  stored == null
    ? t("log_sinks.values.defaultSuffix", { value: label })
    : label;

const seconds = (stored: number | undefined, fallback: string, t: TFunction) =>
  stored ? t("log_sinks.values.timeoutSeconds", { count: stored }) : fallback;

const buffer: Field = field("log_sinks.fields.bufferSizeShort", (sink, t) => {
  const bytes = sink.spec?.buffer?.max_size;
  return bytes
    ? t("log_sinks.values.bufferGib", { value: bytesToGib(bytes) })
    : t("log_sinks.values.bufferDefault");
});

const s3Fields: Field[] = [
  field("log_sinks.fields.endpoint", (sink, t) => {
    return s3(sink)?.endpoint || t("log_sinks.values.endpointDefault");
  }),
  field("log_sinks.fields.region", (sink) => s3(sink)?.region),
  field("log_sinks.fields.bucket", (sink) => s3(sink)?.bucket),
  field("log_sinks.fields.keyPrefix", (sink, t) => {
    return s3(sink)?.key_prefix || withDefault(null, S3_DEFAULT_KEY_PREFIX, t);
  }),
  field("log_sinks.fields.addressing", (sink, t) => {
    const stored = s3(sink)?.force_path_style;
    const pathStyle = stored ?? S3_DEFAULT_FORCE_PATH_STYLE;
    const label = pathStyle
      ? t("log_sinks.values.pathStyle")
      : t("log_sinks.values.virtualHosted");
    return withDefault(stored, label, t);
  }),
  field("log_sinks.fields.compression", (sink, t) => {
    const stored = s3(sink)?.compression;
    const used = stored ?? S3_DEFAULT_COMPRESSION;
    return withDefault(stored, t(`log_sinks.compressions.${used}`), t);
  }),
  field("log_sinks.fields.flushInterval", (sink, t) => {
    const fallback = t("log_sinks.values.flushIntervalDefault");
    return seconds(s3(sink)?.flush_interval_seconds, fallback, t);
  }),
  buffer,
];

const username: Field = field("log_sinks.fields.username", (sink) => {
  return vl(sink)?.auth?.username;
});

const victoriaLogsFields = (sink: LogSink): Field[] => {
  const authType = toAuthType(vl(sink)?.auth?.type);
  return [
    field("log_sinks.fields.url", (now) => vl(now)?.url),
    field("log_sinks.fields.authType", (_, t) =>
      t(`log_sinks.authTypes.${authType}`),
    ),
    ...(authType === "basic" ? [username] : []),
    field("log_sinks.fields.insecureSkipVerify", (now) => {
      return vl(now)?.insecure_skip_verify ?? false;
    }),
    field("log_sinks.fields.caCert", (now, t) => {
      const stored = vl(now)?.ca_cert;
      return stored ? t("log_sinks.values.set") : t("log_sinks.values.notSet");
    }),
    field("log_sinks.fields.timeout", (now, t) => {
      const fallback = t("log_sinks.values.timeoutDefault");
      return seconds(vl(now)?.timeout_seconds, fallback, t);
    }),
    buffer,
    field("log_sinks.fields.extraFields", (now) => vl(now)?.extra_fields, {
      span: 4,
    }),
  ];
};

export const logSinkHeaderFields: Field[] = [
  field("log_sinks.fields.enabled", (sink) => isLogSinkEnabled(sink.spec)),
];

/** The destination settings of the sink's type. */
export const logSinkDestinationFields = (sink: LogSink): Field[] => [
  field("log_sinks.fields.type", (now, t) =>
    t(`log_sinks.types.${now.spec?.type}`),
  ),
  ...(sink.spec?.type === "s3" ? s3Fields : victoriaLogsFields(sink)),
];

const message: Field = field("common.fields.message", lastMessage, { span: 4 });

/** Counters and the last delivery and automatic test; the API omits zero counters. */
export const logSinkDeliveryFields = (sink: LogSink): Field[] => [
  field("log_sinks.fields.sentEvents", (now) => now.status?.sent_events ?? 0),
  field("log_sinks.fields.droppedEvents", (now) => {
    return now.status?.dropped_events ?? 0;
  }),
  field("log_sinks.fields.lastSentTime", {
    render: (now) => (
      <Timestamp timestamp={now.status?.last_sent_time} relative />
    ),
  }),
  field("log_sinks.fields.lastConnectionTest", {
    render: (now) => <ConnectionTestResult test={lastTest(now)} />,
  }),
  ...(lastMessage(sink) ? [message] : []),
];
