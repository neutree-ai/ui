import { useShow } from "@refinedev/core";
import { LogSinkEnableAction } from "@/domains/log-sink/components/LogSinkEnableAction";
import LogSinkEnabled from "@/domains/log-sink/components/LogSinkEnabled";
import LogSinkStatus from "@/domains/log-sink/components/LogSinkStatus";
import TestConnectionButton from "@/domains/log-sink/components/TestConnectionButton";
import { useLogSinkDeleteConfirmation } from "@/domains/log-sink/hooks/use-log-sink-delete-confirmation";
import { useLogSinkTestConnection } from "@/domains/log-sink/hooks/use-log-sink-test-connection";
import { formatEventCount } from "@/domains/log-sink/lib/log-sink-display";
import {
  bytesToGib,
  S3_DEFAULT_KEY_PREFIX,
} from "@/domains/log-sink/lib/log-sink-form";
import type { LogSink } from "@/domains/log-sink/types";
import { EmptyValue } from "@/foundation/components/EmptyValue";
import { Loader } from "@/foundation/components/Loader";
import { MetadataTimestampMeta } from "@/foundation/components/MetadataTimestampMeta";
import { ShowPage } from "@/foundation/components/ShowPage";
import Timestamp from "@/foundation/components/Timestamp";
import { useTranslation } from "@/foundation/lib/i18n";

// Fields and sections: src/domains/log-sink/data.md (Detail).
export const LogSinksShow = () => {
  const { t } = useTranslation();
  const deleteConfirmation = useLogSinkDeleteConfirmation();
  const connectionTest = useLogSinkTestConnection();
  const {
    query: { data, isLoading },
  } = useShow<LogSink>();
  const record = data?.data;

  if (isLoading) {
    return <Loader className="h-4 text-primary" />;
  }

  if (!record) {
    return <div>{t("pages.error.notFound")}</div>;
  }

  const isS3 = record.spec?.type === "s3";
  const vl = record.spec?.victorialogs;
  const s3 = record.spec?.s3;
  const authType =
    vl?.auth?.type === "basic" || vl?.auth?.type === "bearer"
      ? vl.auth.type
      : "none";
  const maxSize = record.spec?.buffer?.max_size;
  const extraFields = Object.entries(vl?.extra_fields ?? {});
  const lastTest = record.status?.last_connection_test;

  return (
    <ShowPage
      record={record}
      deleteConfirmation={deleteConfirmation(record.metadata.name)}
      extraActions={() => <LogSinkEnableAction sink={record} />}
    >
      <ShowPage.ObjectHeader
        title={record.metadata.name}
        status={<LogSinkStatus {...record.status} />}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1">
            <ShowPage.Meta label={t("log_sinks.fields.enabled")}>
              <LogSinkEnabled enabled={record.spec?.enabled} />
            </ShowPage.Meta>
            <MetadataTimestampMeta metadata={record.metadata} />
          </span>
        }
      />
      <div className="mt-4 space-y-3">
        <ShowPage.Section title={t("log_sinks.sections.destination")}>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-4">
            <ShowPage.Row title={t("log_sinks.fields.type")}>
              {t(`log_sinks.types.${record.spec?.type}`)}
            </ShowPage.Row>
            {isS3 ? (
              <>
                <ShowPage.Row title={t("log_sinks.fields.endpoint")}>
                  <span className="break-all">
                    {s3?.endpoint || t("log_sinks.values.endpointDefault")}
                  </span>
                </ShowPage.Row>
                <ShowPage.Row title={t("log_sinks.fields.region")}>
                  <span>{s3?.region}</span>
                </ShowPage.Row>
                <ShowPage.Row title={t("log_sinks.fields.bucket")}>
                  <span className="break-all">{s3?.bucket}</span>
                </ShowPage.Row>
                <ShowPage.Row title={t("log_sinks.fields.keyPrefix")}>
                  <span className="break-all">
                    {s3?.key_prefix ||
                      t("log_sinks.values.defaultSuffix", {
                        value: S3_DEFAULT_KEY_PREFIX,
                      })}
                  </span>
                </ShowPage.Row>
                <ShowPage.Row title={t("log_sinks.fields.addressing")}>
                  {s3?.force_path_style === false
                    ? t("log_sinks.values.virtualHosted")
                    : s3?.force_path_style
                      ? t("log_sinks.values.pathStyle")
                      : t("log_sinks.values.defaultSuffix", {
                          value: t("log_sinks.values.pathStyle"),
                        })}
                </ShowPage.Row>
                <ShowPage.Row title={t("log_sinks.fields.compression")}>
                  {s3?.compression
                    ? t(`log_sinks.compressions.${s3.compression}`)
                    : t("log_sinks.values.defaultSuffix", {
                        value: t("log_sinks.compressions.gzip"),
                      })}
                </ShowPage.Row>
                <ShowPage.Row title={t("log_sinks.fields.flushInterval")}>
                  {s3?.flush_interval_seconds
                    ? t("log_sinks.values.timeoutSeconds", {
                        count: s3.flush_interval_seconds,
                      })
                    : t("log_sinks.values.flushIntervalDefault")}
                </ShowPage.Row>
                <ShowPage.Row title={t("log_sinks.fields.bufferSizeShort")}>
                  {maxSize
                    ? t("log_sinks.values.bufferGib", {
                        value: bytesToGib(maxSize),
                      })
                    : t("log_sinks.values.bufferDefault")}
                </ShowPage.Row>
              </>
            ) : (
              <>
                <ShowPage.Row title={t("log_sinks.fields.url")}>
                  <span className="break-all">{vl?.url}</span>
                </ShowPage.Row>
                <ShowPage.Row title={t("log_sinks.fields.authType")}>
                  {t(`log_sinks.authTypes.${authType}`)}
                </ShowPage.Row>
                {authType === "basic" && (
                  <ShowPage.Row title={t("log_sinks.fields.username")}>
                    {vl?.auth?.username ?? <EmptyValue />}
                  </ShowPage.Row>
                )}
                <ShowPage.Row title={t("log_sinks.fields.insecureSkipVerify")}>
                  {vl?.insecure_skip_verify
                    ? t("log_sinks.values.yes")
                    : t("log_sinks.values.no")}
                </ShowPage.Row>
                <ShowPage.Row title={t("log_sinks.fields.caCert")}>
                  {vl?.ca_cert
                    ? t("log_sinks.values.set")
                    : t("log_sinks.values.notSet")}
                </ShowPage.Row>
                <ShowPage.Row title={t("log_sinks.fields.timeout")}>
                  {vl?.timeout_seconds
                    ? t("log_sinks.values.timeoutSeconds", {
                        count: vl.timeout_seconds,
                      })
                    : t("log_sinks.values.timeoutDefault")}
                </ShowPage.Row>
                <ShowPage.Row title={t("log_sinks.fields.bufferSizeShort")}>
                  {maxSize
                    ? t("log_sinks.values.bufferGib", {
                        value: bytesToGib(maxSize),
                      })
                    : t("log_sinks.values.bufferDefault")}
                </ShowPage.Row>
                <div className="lg:col-span-4">
                  <ShowPage.Row title={t("log_sinks.fields.extraFields")}>
                    {extraFields.length ? (
                      <span className="flex flex-wrap gap-2">
                        {extraFields.map(([key, value]) => (
                          <code
                            key={key}
                            className="rounded bg-muted px-1.5 py-0.5 text-xs"
                          >
                            {key}={value}
                          </code>
                        ))}
                      </span>
                    ) : (
                      <EmptyValue />
                    )}
                  </ShowPage.Row>
                </div>
              </>
            )}
          </div>
        </ShowPage.Section>
        <ShowPage.Section title={t("log_sinks.sections.delivery")}>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-4">
            <ShowPage.Row title={t("log_sinks.fields.sentEvents")}>
              {formatEventCount(record.status?.sent_events)}
            </ShowPage.Row>
            <ShowPage.Row title={t("log_sinks.fields.droppedEvents")}>
              {formatEventCount(record.status?.dropped_events)}
            </ShowPage.Row>
            <ShowPage.Row title={t("log_sinks.fields.lastSentTime")}>
              <Timestamp timestamp={record.status?.last_sent_time} relative />
            </ShowPage.Row>
            <ShowPage.Row title={t("log_sinks.fields.lastConnectionTest")}>
              {lastTest ? (
                <span className="inline-flex flex-wrap items-center gap-2">
                  <span
                    className={
                      lastTest.ok
                        ? "text-[var(--nt-text-colorful-positive)]"
                        : "text-[var(--nt-text-colorful-serious)]"
                    }
                  >
                    {lastTest.ok
                      ? t("log_sinks.values.testOk")
                      : t("log_sinks.values.testFailed")}
                  </span>
                  <Timestamp timestamp={lastTest.time} relative />
                </span>
              ) : (
                t("log_sinks.values.never")
              )}
            </ShowPage.Row>
            {lastTest?.message && (
              <div className="lg:col-span-4">
                <ShowPage.Row title={t("common.fields.message")}>
                  <span className="whitespace-pre-wrap break-words font-normal">
                    {lastTest.message}
                  </span>
                </ShowPage.Row>
              </div>
            )}
            <div className="lg:col-span-4">
              <TestConnectionButton
                testing={connectionTest.testing}
                result={connectionTest.result}
                onTest={() =>
                  connectionTest.test({ mode: "stored", id: record.id })
                }
              />
            </div>
          </div>
        </ShowPage.Section>
      </div>
    </ShowPage>
  );
};
