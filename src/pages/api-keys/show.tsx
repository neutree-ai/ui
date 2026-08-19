import { useNavigation, useShow } from "@refinedev/core";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
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
  const { list } = useNavigation();
  const {
    data: projects,
    isLoading: isProjectLoading,
    error: projectError,
  } = useApiKeyProjects(record?.metadata.workspace);
  const project = projects.find(
    (candidate) => candidate.id === record?.project_id,
  );

  if (isLoading) {
    return <div>{t("api_keys.messages.loading")}</div>;
  }

  if (!record) {
    return <div>{t("api_keys.messages.notFound")}</div>;
  }

  return (
    <div className="w-full h-full">
      <Button
        variant="ghost"
        className="mb-2 px-0"
        onClick={() => list("api_keys")}
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Projects
      </Button>
      <ShowPage
        record={record as ApiKey}
        canEdit={false}
        showCurrentBreadcrumb={false}
      >
        <ShowPage.ObjectHeader
          title={record.metadata.display_name ?? record.metadata.name}
          description={
            <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1">
              <ShowPage.Meta label={t("common.fields.workspace")}>
                {record.metadata.workspace ?? "-"}
              </ShowPage.Meta>
              {record.description && (
                <ShowPage.Meta label="Description">
                  {record.description}
                </ShowPage.Meta>
              )}
              <ShowPage.Meta label={t("api_keys.fields.usage")}>
                {record.status?.usage ?? "-"}
              </ShowPage.Meta>
              <ShowPage.Meta label="Project">
                {!record.project_id
                  ? "Ungrouped"
                  : isProjectLoading
                    ? "Loading..."
                    : projectError
                      ? "Unable to load Project"
                      : (project?.name ?? "-")}
              </ShowPage.Meta>
              <MetadataTimestampMeta metadata={record.metadata} />
            </span>
          }
        />
        {record.id && (
          <div className="mt-4 space-y-4">
            <MetadataDisclosure metadata={record.metadata} />
            <ApiKeyPerformanceCard
              apiKeyId={String(record.id)}
              workspace={record.metadata.workspace}
            />
            <ApiKeyLimitsCard
              apiKeyId={String(record.id)}
              workspace={record.metadata.workspace}
              projectId={record.project_id}
              displayName={record.metadata.display_name ?? record.metadata.name}
              description={record.description}
              onSaved={refetch}
            />
          </div>
        )}
      </ShowPage>
    </div>
  );
};
