import type { TFunction } from "i18next";
import type { ApiKey, ApiKeyProject } from "@/domains/api-key/types";

/**
 * A key group as the list shows it. The ungrouped bucket is synthesised by the
 * RPC with a fixed English name, so it is labelled by translation; only a real
 * Project carries a user-supplied name and can be edited or deleted.
 */
export function apiKeyGroupView(project: ApiKeyProject, t: TFunction) {
  return {
    label: project.is_ungrouped
      ? t("api_keys.projects.ungrouped")
      : project.metadata.name,
    description: project.spec.description || null,
    isProject: !project.is_ungrouped,
  };
}

/** Group labels by id, for naming a key's current Project. */
export const apiKeyGroupLabels = (projects: ApiKeyProject[], t: TFunction) =>
  new Map(
    projects.map((project) => [project.id, apiKeyGroupView(project, t).label]),
  );

/**
 * The Project a key is in, by name: ungrouped without one, `unknown` when the
 * Project is not among `labels`.
 */
export function apiKeyCurrentGroupLabel(
  key: ApiKey,
  labels: Map<string, string>,
  t: TFunction,
): string {
  if (!key.spec.project_id) return t("api_keys.projects.ungrouped");
  return labels.get(key.spec.project_id) ?? t("api_keys.move.unknownProject");
}

/** The keys that a move to `targetProjectId` ("" for ungrouped) would change. */
export const keysMovingTo = (keys: ApiKey[], targetProjectId: string) =>
  keys.filter((key) => (key.spec.project_id ?? "") !== targetProjectId);

/**
 * What the create dialog starts with when opened from a group: its workspace
 * (else the scoped one) and, for a real Project, that Project.
 */
export const createKeyPreset = (
  project: ApiKeyProject | undefined,
  scopedWorkspace: string | undefined,
) => ({
  workspace: project?.metadata.workspace ?? scopedWorkspace ?? "",
  projectId: project?.is_ungrouped ? "" : (project?.id ?? ""),
});

/** A Project as the picker lists it; `searchText` is what the search matches. */
export const projectPickerOption = (project: ApiKeyProject) => ({
  label: project.metadata.name,
  description: project.spec.description || null,
  searchText: `${project.metadata.name} ${project.spec.description}`,
});

/** The name of the Project `id`, or undefined when it is not listed. */
export const projectNameById = (
  projects: ApiKeyProject[],
  id: string | null | undefined,
) => projects.find((project) => project.id === id)?.metadata.name;
