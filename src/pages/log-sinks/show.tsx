import { useShow } from "@refinedev/core";
import { LogSinkEnableAction } from "@/domains/log-sink/components/LogSinkEnableAction";
import TestConnectionButton from "@/domains/log-sink/components/TestConnectionButton";
import { useLogSinkDeleteConfirmation } from "@/domains/log-sink/hooks/use-log-sink-delete-confirmation";
import { useLogSinkTestConnection } from "@/domains/log-sink/hooks/use-log-sink-test-connection";
import {
  logSinkDeliveryFields,
  logSinkDestinationFields,
  logSinkHeaderFields,
} from "@/domains/log-sink/lib/detail-fields";
import { logSinkPhases } from "@/domains/log-sink/lib/phases";
import type { LogSink } from "@/domains/log-sink/types";
import { Loader } from "@/foundation/components/Loader";
import { useTranslation } from "@/foundation/lib/i18n";
import { PhaseStatus } from "@/foundation/role/PhaseStatus";
import { DetailFields } from "@/foundation/scene/DetailFields";
import { MetadataTimestampMeta } from "@/foundation/scene/MetadataTimestampMeta";
import { ShowPage } from "@/foundation/scene/ShowPage";

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

  return (
    <ShowPage
      record={record}
      deleteConfirmation={deleteConfirmation(record.metadata.name)}
      extraActions={() => <LogSinkEnableAction sink={record} />}
    >
      <ShowPage.ObjectHeader
        title={record.metadata.name}
        status={<PhaseStatus status={record.status} phases={logSinkPhases} />}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1">
            <DetailFields inline fields={logSinkHeaderFields} record={record} />
            <MetadataTimestampMeta metadata={record.metadata} />
          </span>
        }
      />
      <div className="mt-4 space-y-3">
        <ShowPage.Section title={t("log_sinks.sections.destination")}>
          <DetailFields
            fields={logSinkDestinationFields(record)}
            record={record}
          />
        </ShowPage.Section>
        <ShowPage.Section title={t("log_sinks.sections.delivery")}>
          <DetailFields
            fields={logSinkDeliveryFields(record)}
            record={record}
          />
          <div className="mt-5">
            <TestConnectionButton
              testing={connectionTest.testing}
              result={connectionTest.result}
              onTest={() =>
                connectionTest.test({ mode: "stored", id: record.id })
              }
            />
          </div>
        </ShowPage.Section>
      </div>
    </ShowPage>
  );
};
