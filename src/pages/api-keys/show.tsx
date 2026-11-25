import { useList, useShow } from "@refinedev/core";
import { useTranslation } from "react-i18next";
import { ApiKeyLimitsCard } from "@/domains/api-key/components/ApiKeyLimitsCard";
import { ApiKeyPerformanceCard } from "@/domains/api-key/components/ApiKeyPerformanceCard";
import { useApiKeyProjects } from "@/domains/api-key/hooks/use-api-key-projects";
import { apiKeyHeaderFields } from "@/domains/api-key/lib/detail-fields";
import type { ApiKey } from "@/domains/api-key/types";
import { ApiKeyGroupPolicyHint } from "@/domains/group-policy/components/ApiKeyGroupPolicyHint";
import { userModelAccessHref } from "@/domains/group-policy/components/UserGroupModelAccess";
import { ServiceAccountLabel } from "@/domains/service-account/components/ServiceAccountLabel";
import { displayName } from "@/foundation/role/display-name";
import { DetailFields } from "@/foundation/scene/DetailFields";
import { MetadataTimestampMeta } from "@/foundation/scene/MetadataTimestampMeta";
import { ShowPage } from "@/foundation/scene/ShowPage";
import type { Metadata } from "@/foundation/types/basic-types";

export const ApiKeysShow = () => {
  const { t } = useTranslation();
  const {
    query: { data, isLoading, refetch },
  } = useShow();
  const record = data?.data as ApiKey | undefined;
  const serviceAccountId = record?.service_account_id ?? undefined;
  const {
    data: projects,
    isLoading: isProjectLoading,
    error: projectError,
  } = useApiKeyProjects(
    serviceAccountId === undefined
      ? (record?.metadata.workspace ?? undefined)
      : undefined,
  );
  // Readable only to whoever may read the owner: no profile, no link.
  const { data: owners } = useList<{ metadata: Metadata }>({
    resource: "user_profiles",
    filters: [{ field: "id", operator: "eq", value: record?.user_id }],
    queryOptions: { enabled: !!record?.user_id },
  });
  const ownerProfile = owners?.data?.[0]?.metadata?.name;
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
          title={displayName(record.metadata)}
          description={
            <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1">
              <DetailFields
                inline
                fields={apiKeyHeaderFields(
                  record,
                  {
                    name: project?.metadata.name,
                    isLoading: isProjectLoading,
                    error: projectError,
                  },
                  (id) => <ServiceAccountLabel id={id} />,
                )}
                record={record}
              />
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
            {(record.user_id || serviceAccountId) &&
              record.metadata.workspace && (
                <ApiKeyGroupPolicyHint
                  ownerId={record.user_id ?? serviceAccountId ?? ""}
                  workspace={record.metadata.workspace}
                  profileHref={
                    ownerProfile
                      ? userModelAccessHref(
                          ownerProfile,
                          record.metadata.workspace,
                        )
                      : undefined
                  }
                />
              )}
            <ApiKeyLimitsCard
              apiKeyId={String(record.id)}
              workspace={record.metadata.workspace ?? ""}
              projectId={record.spec.project_id ?? null}
              displayName={displayName(record.metadata)}
              description={record.spec.description ?? ""}
              serviceAccountId={serviceAccountId}
              onSaved={refetch}
            />
          </div>
        )}
      </ShowPage>
    </div>
  );
};
