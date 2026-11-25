import type { TFunction } from "i18next";
import type { ReactNode } from "react";
import type { ApiKey } from "@/domains/api-key/types";
import { type DetailField, field } from "@/foundation/scene/detail-field";

/** The lookup of the key's project: its name once loaded. */
export type ProjectLookup = {
  name?: string;
  isLoading: boolean;
  error: unknown;
};

const description: DetailField<ApiKey> = field(
  "api_keys.fields.description",
  (key) => key.spec.description,
);

const projectLabel = (key: ApiKey, project: ProjectLookup, t: TFunction) => {
  if (!key.spec.project_id) return t("api_keys.projects.ungrouped");
  if (project.isLoading) return t("api_keys.messages.loading");
  if (project.error) return t("api_keys.projects.loadFailed");
  return project.name;
};

/**
 * The header fields. An application's key names the application, rendered by
 * the page; a user's key names its project.
 */
export const apiKeyHeaderFields = (
  key: ApiKey,
  project: ProjectLookup,
  renderApplication: (id: string) => ReactNode,
): DetailField<ApiKey>[] => {
  const application = key.service_account_id;
  return [
    field("common.fields.workspace", (current) => current.metadata.workspace),
    ...(key.spec.description ? [description] : []),
    field("api_keys.fields.usage", (current) => current.status?.usage),
    application != null
      ? field("api_keys.fields.application", {
          render: () => renderApplication(application),
        })
      : field("api_keys.fields.project", (current, t) =>
          projectLabel(current, project, t),
        ),
  ];
};
