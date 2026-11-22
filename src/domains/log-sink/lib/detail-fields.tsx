import type { TFunction } from "i18next";
import {
  bytesToGib,
  isLogSinkEnabled,
  S3_DEFAULT_COMPRESSION,
  S3_DEFAULT_FORCE_PATH_STYLE,
  S3_DEFAULT_KEY_PREFIX,
  toAuthType,
} from "@/domains/log-sink/lib/log-sink-form";
import type { LogSink, LogSinkConnectionTest } from "@/domains/log-sink/types";
import { useTranslation } from "@/foundation/lib/i18n";
import Timestamp from "@/foundation/role/Timestamp";
import type { DetailField } from "@/foundation/scene/DetailFields";

type Field = DetailField<LogSink>;

/** `label` as stored, or marked as the default when the API omits it. */
const withDefault = (stored: unknown, label: string, t: TFunction) =>
  stored == null
    ? t("log_sinks.values.defaultSuffix", { value: label })
    : label;

const type: Field = {
  key: "type",
  label: "log_sinks.fields.type",
  value: (sink, t) => t(`log_sinks.types.${sink.spec?.type}`),
};

const buffer: Field = {
  key: "buffer",
  label: "log_sinks.fields.bufferSizeShort",
  value: (sink, t) =>
    sink.spec?.buffer?.max_size
      ? t("log_sinks.values.bufferGib", {
          value: bytesToGib(sink.spec.buffer.max_size),
        })
      : t("log_sinks.values.bufferDefault"),
};

const s3Fields: Field[] = [
  {
    key: "endpoint",
    label: "log_sinks.fields.endpoint",
    value: (sink, t) =>
      sink.spec?.s3?.endpoint || t("log_sinks.values.endpointDefault"),
  },
  {
    key: "region",
    label: "log_sinks.fields.region",
    value: (sink) => sink.spec?.s3?.region,
  },
  {
    key: "bucket",
    label: "log_sinks.fields.bucket",
    value: (sink) => sink.spec?.s3?.bucket,
  },
  {
    key: "keyPrefix",
    label: "log_sinks.fields.keyPrefix",
    value: (sink, t) =>
      sink.spec?.s3?.key_prefix ||
      t("log_sinks.values.defaultSuffix", { value: S3_DEFAULT_KEY_PREFIX }),
  },
  {
    key: "addressing",
    label: "log_sinks.fields.addressing",
    value: (sink, t) => {
      const stored = sink.spec?.s3?.force_path_style;
      return withDefault(
        stored,
        t(
          (stored ?? S3_DEFAULT_FORCE_PATH_STYLE)
            ? "log_sinks.values.pathStyle"
            : "log_sinks.values.virtualHosted",
        ),
        t,
      );
    },
  },
  {
    key: "compression",
    label: "log_sinks.fields.compression",
    value: (sink, t) => {
      const stored = sink.spec?.s3?.compression;
      return withDefault(
        stored,
        t(`log_sinks.compressions.${stored ?? S3_DEFAULT_COMPRESSION}`),
        t,
      );
    },
  },
  {
    key: "flushInterval",
    label: "log_sinks.fields.flushInterval",
    value: (sink, t) =>
      sink.spec?.s3?.flush_interval_seconds
        ? t("log_sinks.values.timeoutSeconds", {
            count: sink.spec.s3.flush_interval_seconds,
          })
        : t("log_sinks.values.flushIntervalDefault"),
  },
  buffer,
];

const username: Field = {
  key: "username",
  label: "log_sinks.fields.username",
  value: (sink) => sink.spec?.victorialogs?.auth?.username,
};

const victoriaLogsFields = (sink: LogSink): Field[] => {
  const authType = toAuthType(sink.spec?.victorialogs?.auth?.type);
  return [
    {
      key: "url",
      label: "log_sinks.fields.url",
      value: (current) => current.spec?.victorialogs?.url,
    },
    {
      key: "authType",
      label: "log_sinks.fields.authType",
      value: (_, t) => t(`log_sinks.authTypes.${authType}`),
    },
    ...(authType === "basic" ? [username] : []),
    {
      key: "insecureSkipVerify",
      label: "log_sinks.fields.insecureSkipVerify",
      value: (current) =>
        current.spec?.victorialogs?.insecure_skip_verify ?? false,
    },
    {
      key: "caCert",
      label: "log_sinks.fields.caCert",
      value: (current, t) =>
        current.spec?.victorialogs?.ca_cert
          ? t("log_sinks.values.set")
          : t("log_sinks.values.notSet"),
    },
    {
      key: "timeout",
      label: "log_sinks.fields.timeout",
      value: (current, t) =>
        current.spec?.victorialogs?.timeout_seconds
          ? t("log_sinks.values.timeoutSeconds", {
              count: current.spec.victorialogs.timeout_seconds,
            })
          : t("log_sinks.values.timeoutDefault"),
    },
    buffer,
    {
      key: "extraFields",
      label: "log_sinks.fields.extraFields",
      span: 4,
      value: (current) => current.spec?.victorialogs?.extra_fields,
    },
  ];
};

export const logSinkHeaderFields: Field[] = [
  {
    key: "enabled",
    label: "log_sinks.fields.enabled",
    value: (sink) => isLogSinkEnabled(sink.spec),
  },
];

/** The destination settings of the sink's type. */
export const logSinkDestinationFields = (sink: LogSink): Field[] => [
  type,
  ...(sink.spec?.type === "s3" ? s3Fields : victoriaLogsFields(sink)),
];

function LastConnectionTest({ test }: { test?: LogSinkConnectionTest | null }) {
  const { t } = useTranslation();

  if (!test) return t("log_sinks.values.never");

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span
        className={
          test.ok
            ? "text-[var(--nt-text-colorful-positive)]"
            : "text-[var(--nt-text-colorful-serious)]"
        }
      >
        {test.ok
          ? t("log_sinks.values.testOk")
          : t("log_sinks.values.testFailed")}
      </span>
      <Timestamp timestamp={test.time} relative />
    </span>
  );
}

const lastTestMessage: Field = {
  key: "lastTestMessage",
  label: "common.fields.message",
  span: 4,
  render: (sink) => (
    <span className="whitespace-pre-wrap break-words font-normal">
      {sink.status?.last_connection_test?.message}
    </span>
  ),
};

/** Counters and the last delivery and automatic test; the API omits zero counters. */
export const logSinkDeliveryFields = (sink: LogSink): Field[] => [
  {
    key: "sentEvents",
    label: "log_sinks.fields.sentEvents",
    value: (current) => current.status?.sent_events ?? 0,
  },
  {
    key: "droppedEvents",
    label: "log_sinks.fields.droppedEvents",
    value: (current) => current.status?.dropped_events ?? 0,
  },
  {
    key: "lastSentTime",
    label: "log_sinks.fields.lastSentTime",
    render: (current) => (
      <Timestamp timestamp={current.status?.last_sent_time} relative />
    ),
  },
  {
    key: "lastConnectionTest",
    label: "log_sinks.fields.lastConnectionTest",
    render: (current) => (
      <LastConnectionTest test={current.status?.last_connection_test} />
    ),
  },
  ...(sink.status?.last_connection_test?.message ? [lastTestMessage] : []),
];
