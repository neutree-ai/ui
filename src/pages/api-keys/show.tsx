import { useShow } from "@refinedev/core";
import { useTranslation } from "react-i18next";
import { ApiKeyLimitsCard } from "@/domains/api-key/components/ApiKeyLimitsCard";
import { ApiKeyPerformanceCard } from "@/domains/api-key/components/ApiKeyPerformanceCard";
import { useApiKeyProjects } from "@/domains/api-key/hooks/use-api-key-projects";
import type { ApiKey } from "@/domains/api-key/types";
import { ApiKeyGroupPolicyHint } from "@/domains/group-policy/components/ApiKeyGroupPolicyHint";
import { useTeams } from "@/domains/organization/hooks/use-organization";
import { displayName } from "@/domains/organization/lib/org-tree";
import { EmptyValue } from "@/foundation/components/EmptyValue";
import { MetadataTimestampMeta } from "@/foundation/components/MetadataTimestampMeta";
import { ShowPage } from "@/foundation/components/ShowPage";

export const ApiKeysShow = () => {
  const { t } = useTranslation();
  const {
    query: { data, isLoading, refetch },
  } = useShow();
  const record = data?.data as ApiKey | undefined;
  const teamId = record?.team_id ?? undefined;
  const teams = useTeams(teamId !== undefined);
  const team = teams.data?.data.find((candidate) => candidate.id === teamId);
  const {
    data: projects,
    isLoading: isProjectLoading,
    error: projectError,
  } = useApiKeyProjects(
    teamId === undefined
      ? (record?.metadata.workspace ?? undefined)
      : undefined,
  );
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
      <ShowPage record={record} canEdit={false} showCurrentBreadcrumb={false}>
        <ShowPage.ObjectHeader
          title={record.metadata.display_name || record.metadata.name}
          description={
            <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1">
              <ShowPage.Meta label={t("common.fields.workspace")}>
                {record.metadata.workspace ?? <EmptyValue />}
              </ShowPage.Meta>
              {record.spec.description && (
                <ShowPage.Meta label={t("api_keys.fields.description")}>
                  {record.spec.description}
                </ShowPage.Meta>
              )}
              <ShowPage.Meta label={t("api_keys.fields.usage")}>
                {record.status?.usage ?? <EmptyValue />}
              </ShowPage.Meta>
              {teamId !== undefined ? (
                <ShowPage.Meta label={t("api_keys.fields.team")}>
                  {team ? displayName(team.metadata) : `#${teamId}`}
                </ShowPage.Meta>
              ) : (
                <ShowPage.Meta label={t("api_keys.fields.project")}>
                  {!record.spec.project_id
                    ? t("api_keys.projects.ungrouped")
                    : isProjectLoading
                      ? t("api_keys.messages.loading")
                      : projectError
                        ? t("api_keys.projects.loadFailed")
                        : (project?.metadata.name ?? <EmptyValue />)}
                </ShowPage.Meta>
              )}
              <MetadataTimestampMeta metadata={record.metadata} />
            </span>
          }
        />
        {record.id && (
          <div className="mt-4 space-y-3">
            <ApiKeyPerformanceCard
              apiKeyId={String(record.id)}
              workspace={record.metadata.workspace ?? ""}
            />
            {record.user_id && record.metadata.workspace && (
              <ApiKeyGroupPolicyHint
                userId={record.user_id}
                workspace={record.metadata.workspace}
              />
            )}
            <ApiKeyLimitsCard
              apiKeyId={String(record.id)}
              workspace={record.metadata.workspace ?? ""}
              projectId={record.spec.project_id ?? null}
              displayName={record.metadata.display_name || record.metadata.name}
              description={record.spec.description ?? ""}
              teamId={teamId}
              onSaved={refetch}
            />
          </div>
        )}
      </ShowPage>
    </div>
  );
};
