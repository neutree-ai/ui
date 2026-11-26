import type { ApiKey, ApiKeyProject } from "@/domains/api-key/types";
import {
  fixtureMetadata,
  VISUAL_WORKSPACE,
} from "@/foundation/testing/visual-fixtures";

function makeApiKey(
  serial: number,
  name: string,
  metadata: Parameters<typeof fixtureMetadata>[1],
  usage: number | null,
  description?: string,
): ApiKey {
  return {
    id: `00000000-0000-4000-8000-0000000000${String(serial).padStart(2, "0")}`,
    api_version: "v1",
    kind: "ApiKey",
    metadata: fixtureMetadata(name, {
      workspace: VISUAL_WORKSPACE,
      ...metadata,
    }),
    spec: { quota: 1000000, project_id: null, description },
    status: {
      phase: null,
      last_transition_time: null,
      error_message: null,
      sk_value: null,
      usage,
      last_used_at: null,
      last_sync_at: null,
    },
    user_id: null,
  };
}

/** A key with a display name, a description and a large usage count. */
export const usedApiKey = makeApiKey(
  1,
  "ci-pipeline",
  { display_name: "CI pipeline" },
  1234567,
  "Used by the nightly evaluation jobs",
);

/** A key whose display name is only whitespace and which has no usage yet. */
export const unusedApiKey = makeApiKey(
  2,
  "scratch-key",
  { display_name: "  " },
  null,
);

/** A key whose description is only whitespace. */
export const blankDescriptionApiKey = makeApiKey(
  3,
  "batch-jobs",
  { display_name: "Batch jobs" },
  42,
  "   ",
);

const listedKeys = [usedApiKey, unusedApiKey, blankDescriptionApiKey];

/** The list page's one group: the ungrouped bucket holding every fixture key. */
export const apiKeyListRpc = {
  get_api_key_project_groups: [
    {
      project: {
        id: "00000000-0000-4000-8000-000000000100",
        api_version: "v1",
        kind: "ApiKeyProject",
        metadata: fixtureMetadata("ungrouped", { workspace: VISUAL_WORKSPACE }),
        spec: { description: "" },
        user_id: "",
        is_ungrouped: true,
      } satisfies ApiKeyProject,
      api_keys: listedKeys,
      api_key_count: listedKeys.length,
      current_usage: 0,
      total_projects: 1,
    },
  ],
  count_api_key_project_group_api_keys: listedKeys.length,
};
