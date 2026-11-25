import type { ApiKeyProject } from "@/domains/api-key/types";

/**
 * The listed group that keys moved to `targetProjectId` land in: that Project,
 * or for an empty id the ungrouped bucket of `workspace`. Undefined when the
 * group is not among `groups`.
 */
export function moveTargetGroupId(
  groups: ApiKeyProject[],
  targetProjectId: string,
  workspace: string,
): string | undefined {
  return groups.find((project) =>
    targetProjectId
      ? !project.is_ungrouped && project.id === targetProjectId
      : project.is_ungrouped && project.metadata.workspace === workspace,
  )?.id;
}
