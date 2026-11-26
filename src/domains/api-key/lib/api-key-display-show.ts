import type { ApiKey } from "@/domains/api-key/types";

/**
 * What the show page reads from its key. Only a personal key looks up its
 * workspace's Projects; the group-policy hint names the key's owner, the user
 * or else the application.
 */
export function apiKeyShowContext(key: ApiKey | undefined) {
  const applicationId = key?.service_account_id ?? undefined;
  return {
    applicationId,
    projectsWorkspace:
      applicationId === undefined
        ? (key?.metadata.workspace ?? undefined)
        : undefined,
    userId: key?.user_id ?? undefined,
    policyOwnerId: key?.user_id || applicationId,
    workspace: key?.metadata.workspace ?? "",
    projectId: key?.spec.project_id ?? null,
    description: key?.spec.description ?? "",
  };
}
