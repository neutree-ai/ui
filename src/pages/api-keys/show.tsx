import { useShow } from "@refinedev/core";
import { useTranslation } from "react-i18next";
import { ApiKeyLimitsCard } from "@/domains/api-key/components/ApiKeyLimitsCard";
import { ApiKeyPerformanceCard } from "@/domains/api-key/components/ApiKeyPerformanceCard";
import MetadataCard from "@/foundation/components/MetadataCard";
import { ShowPage } from "@/foundation/components/ShowPage";

export const ApiKeysShow = () => {
  const { t } = useTranslation();
  const {
    query: { data, isLoading },
  } = useShow();
  const record = data?.data;

  if (isLoading) {
    return <div>{t("api_keys.messages.loading")}</div>;
  }

  if (!record) {
    return <div>{t("api_keys.messages.notFound")}</div>;
  }

  return (
    <div className="w-full h-full">
      <ShowPage record={record} canEdit={false} showCurrentBreadcrumb={false}>
        <ShowPage.ObjectHeader
          title={record.metadata.name}
          description={
            <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1">
              <ShowPage.Meta label={t("common.fields.workspace")}>
                {record.metadata.workspace ?? "-"}
              </ShowPage.Meta>
              <ShowPage.Meta label={t("api_keys.fields.usage")}>
                {record.status?.usage ?? "-"}
              </ShowPage.Meta>
			  <ShowPage.Meta label="Description">
				{record.description || "-"}
			  </ShowPage.Meta>
            </span>
          }
        />
        {record.id && (
          <div className="mt-4 space-y-4">
            <MetadataCard metadata={record.metadata} showName={false} />
            <ApiKeyPerformanceCard
              apiKeyId={String(record.id)}
              workspace={record.metadata.workspace}
            />
            <ApiKeyLimitsCard
              apiKeyId={String(record.id)}
              workspace={record.metadata.workspace}
            />
          </div>
        )}
      </ShowPage>
    </div>
  );
};
