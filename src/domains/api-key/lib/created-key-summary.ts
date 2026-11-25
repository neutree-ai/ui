import { apiKeyLabelParts } from "@/domains/api-key/lib/api-key-label";
import type { ApiKey, ApiKeyProject } from "@/domains/api-key/types";

type CreatedKeySummary = {
  /** The name the user typed; blank only for a response without one. */
  name: string;
  /** The description, or null when blank. */
  description: string | null;
  /**
   * Where the key was filed: null for a key that has no Project (an
   * application's), `name` null for the virtual ungrouped group, and `name`
   * set to the Project's name otherwise. A Project missing from `projects`
   * leaves `unresolved` true.
   */
  project: { name: string | null; unresolved: boolean } | null;
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
  if (!hasProject) return { name: primary, description, project: null };

  const projectId = key.spec.project_id;
  if (!projectId) {
    return {
      name: primary,
      description,
      project: { name: null, unresolved: false },
    };
  }
  const name =
    projects.find((project) => project.id === projectId)?.metadata.name ?? null;
  return {
    name: primary,
    description,
    project: { name, unresolved: name === null },
  };
}
