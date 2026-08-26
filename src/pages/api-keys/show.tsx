import { useShow } from "@refinedev/core";
import { useTranslation } from "react-i18next";
import { ApiKeyLimitsCard } from "@/domains/api-key/components/ApiKeyLimitsCard";
import { ApiKeyPerformanceCard } from "@/domains/api-key/components/ApiKeyPerformanceCard";
import { useApiKeyProjects } from "@/domains/api-key/hooks/use-api-key-projects";
import type { ApiKey } from "@/domains/api-key/types";
import { MetadataDisclosure } from "@/foundation/components/MetadataDisclosure";
import { MetadataTimestampMeta } from "@/foundation/components/MetadataTimestampMeta";
import { ShowPage } from "@/foundation/components/ShowPage";

export const ApiKeysShow = () => {
  const { t } = useTranslation();
  const {
    query: { data, isLoading, refetch },
  } = useShow();
  const record = data?.data;
  const {
    data: projects,
    isLoading: isProjectLoading,
    error: projectError,
  } = useApiKeyProjects(record?.metadata.workspace);
  const project = projects.find(
    (candidate) => candidate.id === record?.spec.project_id,
  );

  if (isLoading) {
    return <div>{t("api_keys.messages.loading")}</div>;
  }

  if (!record) {
    return <div>{t("api_keys.messages.notFound")}</div>;
  }

  return (
    <div className="w-full h-full">
      <ShowPage
        record={record as ApiKey}
        canEdit={false}
        showCurrentBreadcrumb={false}
      >
        <ShowPage.ObjectHeader
          title={record.metadata.display_name || record.metadata.name}
          description={
            <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1">
              <ShowPage.Meta label={t("common.fields.workspace")}>
                {record.metadata.workspace ?? "-"}
              </ShowPage.Meta>
              {record.spec.description && (
                <ShowPage.Meta label={t("api_keys.fields.description")}>
                  {record.spec.description}
                </ShowPage.Meta>
              )}
              <ShowPage.Meta label={t("api_keys.fields.usage")}>
                {record.status?.usage ?? "-"}
              </ShowPage.Meta>
              <ShowPage.Meta label={t("api_keys.fields.project")}>
                {!record.spec.project_id
                  ? t("api_keys.projects.ungrouped")
                  : isProjectLoading
                    ? t("api_keys.messages.loading")
                    : projectError
                      ? t("api_keys.projects.loadFailed")
                      : (project?.metadata.name ?? "-")}
              </ShowPage.Meta>
              <MetadataTimestampMeta metadata={record.metadata} />
            </span>
          }
        />
        {record.id && (
          <div className="mt-4 space-y-3">
            <MetadataDisclosure metadata={record.metadata} />
            <ApiKeyPerformanceCard
              apiKeyId={String(record.id)}
              workspace={record.metadata.workspace}
            />
            <ApiKeyLimitsCard
              apiKeyId={String(record.id)}
              workspace={record.metadata.workspace}
              projectId={record.spec.project_id ?? null}
              displayName={record.metadata.display_name || record.metadata.name}
              description={record.spec.description ?? ""}
              onSaved={refetch}
            />
          </div>
        )}
      </ShowPage>
    </div>
  );
};
