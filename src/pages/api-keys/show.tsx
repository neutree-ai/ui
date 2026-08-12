import { useList, useShow } from "@refinedev/core";
import { FolderKanban } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { ApiKeyLimitsCard } from "@/domains/api-key/components/ApiKeyLimitsCard";
import { ApiKeyPerformanceCard } from "@/domains/api-key/components/ApiKeyPerformanceCard";
import type { Project } from "@/domains/api-key/types";
import MetadataCard from "@/foundation/components/MetadataCard";
import { ShowPage } from "@/foundation/components/ShowPage";

export const ApiKeysShow = () => {
  const { t } = useTranslation();
  const {
    query: { data, isLoading },
  } = useShow();
  const record = data?.data;

  const { data: projectsData } = useList<Project>({
    resource: "projects",
    pagination: { mode: "off" },
    queryOptions: { enabled: Boolean(record?.project_id) },
  });
  const project = projectsData?.data?.find(
    (p) => String(p.id) === String(record?.project_id),
  );

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
        {project && (
          <div className="mb-4 rounded-md border bg-muted/20 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
              <FolderKanban className="h-4 w-4 text-muted-foreground" />
              {t("projects.project")}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-semibold">{project.name}</span>
              {project.status === "disabled" ? (
                <Badge variant="secondary">
                  {t("projects.statusDisabled")}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-green-700">
                  {t("projects.statusEnabled")}
                </Badge>
              )}
            </div>
            {project.description && (
              <p className="mt-2 text-sm text-muted-foreground">
                {project.description}
              </p>
            )}
          </div>
        )}
        {record.id && (
          <>
            <ApiKeyPerformanceCard
              apiKeyId={String(record.id)}
              workspace={record.metadata.workspace}
            />
            <ApiKeyLimitsCard
              apiKeyId={String(record.id)}
              workspace={record.metadata.workspace}
            />
          </>
        )}
      </ShowPage>
    </div>
  );
};
