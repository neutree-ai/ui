import { apiKeyLabelParts } from "@/domains/api-key/lib/api-key-label";
import type { ApiKey, ApiKeyProject } from "@/domains/api-key/types";

/** Where a key was filed: no Project, a listed Project, or an id not in the list. */
type CreatedKeyProject =
  | { kind: "ungrouped" }
  | { kind: "named"; name: string }
  | { kind: "unlisted" };

export type CreatedKeySummary = {
  /** The display name, or the technical name without one. */
  name: string;
  /** The description, or null when blank. */
  description: string | null;
  /** Null for a key that cannot have a Project (an application's). */
  project: CreatedKeyProject | null;
};

const projectOf = (
  id: string | null | undefined,
  projects: ApiKeyProject[],
): CreatedKeyProject => {
  if (!id) return { kind: "ungrouped" };
  const name = projects.find((project) => project.id === id)?.metadata.name;
  return name ? { kind: "named", name } : { kind: "unlisted" };
};

/**
 * What the success view of a just-created key confirms. It reads the created
 * key itself; `projects` only turns its Project id into a name.
 */
export function createdKeySummary(
  key: ApiKey,
  { projects, hasProject }: { projects: ApiKeyProject[]; hasProject: boolean },
): CreatedKeySummary {
  const { primary, description } = apiKeyLabelParts({
    name: key.metadata.name,
    displayName: key.metadata.display_name,
    description: key.spec.description,
  });
  return {
    name: primary,
    description,
    project: hasProject ? projectOf(key.spec.project_id, projects) : null,
  };
}

/** The one-time secret of a just-created key, or null when the response has none to show or copy. */
export const createdKeySecret = (key: ApiKey): string | null =>
  key.status?.sk_value || null;
