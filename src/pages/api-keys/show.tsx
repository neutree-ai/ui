import { useGo, useList, useShow } from "@refinedev/core";
import { FolderKanban, Loader2, Undo2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApiKeyLimitsCard } from "@/domains/api-key/components/ApiKeyLimitsCard";
import { ApiKeyPerformanceCard } from "@/domains/api-key/components/ApiKeyPerformanceCard";
import { ProjectPicker } from "@/domains/api-key/components/ProjectPicker";
import {
  rpcErrorMessage,
  useMigrateApiKeys,
} from "@/domains/api-key/hooks/use-api-key-projects";
import type { Project } from "@/domains/api-key/types";
import MetadataCard from "@/foundation/components/MetadataCard";
import { ShowPage } from "@/foundation/components/ShowPage";

export const ApiKeysShow = () => {
  const { t } = useTranslation();
  const go = useGo();
  const {
    query: { data, isLoading, refetch },
  } = useShow();
  const record = data?.data;

  const workspace = record?.metadata?.workspace as string | undefined;

  const { data: projectsData } = useList<Project>({
    resource: "projects",
    pagination: { mode: "off" },
    queryOptions: { enabled: Boolean(workspace) },
  });

  // Projects are Workspace-scoped; narrow the picker to the key's Workspace.
  const projects = (projectsData?.data ?? []).filter(
    (p) => p.workspace === workspace,
  );

  // Editable Project membership: an API key belongs to exactly one Project,
  // and the edit UI must be able to change it (spec 3.2 / 6.3).
  const originalProjectId = record?.project_id
    ? String(record.project_id)
    : null;
  const [projectId, setProjectId] = useState<string | null>(null);
  useEffect(() => {
    setProjectId(originalProjectId);
  }, [originalProjectId]);
  const projectChanged = projectId !== originalProjectId;
  const project = projects.find((p) => String(p.id) === projectId);

  const { migrate } = useMigrateApiKeys();
  const [savingProject, setSavingProject] = useState(false);

  const saveProject = async () => {
    if (!record?.id || !projectId || !projectChanged || savingProject) return;
    setSavingProject(true);
    try {
      await migrate([String(record.id)], projectId);
      toast.success(
        t("projects.migrateSuccess", {
          count: 1,
          project: project?.name ?? "",
        }),
      );
      await refetch();
    } catch (e) {
      toast.error(rpcErrorMessage(e));
    } finally {
      setSavingProject(false);
    }
  };

  const backToList = () => {
    if (workspace) {
      go({ to: `/${workspace}/api-keys`, type: "push" });
    }
  };

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
        {workspace && (
          <div className="mb-4 rounded-md border bg-muted/20 p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <FolderKanban className="h-4 w-4 text-muted-foreground" />
                {t("projects.project")}
              </div>
              <Button variant="ghost" size="sm" onClick={backToList}>
                <Undo2 className="mr-1 h-3.5 w-3.5" />
                {t("projects.backToList")}
              </Button>
            </div>
            {project ? (
              <>
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
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("projects.noProjectsFound")}
              </p>
            )}
            {/* Change the key's Project (moves it between groups) */}
            <div className="mt-3 space-y-1.5">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <ProjectPicker
                    projects={projects}
                    value={projectId}
                    onChange={setProjectId}
                    placeholder={t("projects.selectPlaceholder")}
                  />
                </div>
                <Button
                  size="sm"
                  onClick={() => void saveProject()}
                  disabled={!projectChanged || savingProject}
                >
                  {savingProject && (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  )}
                  {t("buttons.save")}
                </Button>
              </div>
              {project?.status === "disabled" && (
                <p className="text-xs text-muted-foreground">
                  {t("projects.currentDisabledHint")}
                </p>
              )}
            </div>
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
