import { useShow } from "@refinedev/core";
import { useTranslation } from "react-i18next";
import { ApiKeyLimitsCard } from "@/domains/api-key/components/ApiKeyLimitsCard";
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
      <ShowPage record={record} canEdit={false}>
        <MetadataCard metadata={record.metadata} />
        {record.id && (
          <ApiKeyLimitsCard
            apiKeyId={String(record.id)}
            workspace={record.metadata.workspace}
          />
        )}
      </ShowPage>
    </div>
  );
};
