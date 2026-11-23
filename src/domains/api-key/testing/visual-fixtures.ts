import type { ApiKey } from "@/domains/api-key/types";
import {
  fixtureMetadata,
  VISUAL_WORKSPACE,
} from "@/foundation/testing/visual-fixtures";

function makeApiKey(
  name: string,
  metadata: Parameters<typeof fixtureMetadata>[1],
  usage: number | null,
  description?: string,
): ApiKey {
  return {
    id: `00000000-0000-4000-8000-0000000000${name.length}`,
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
  "ci-pipeline",
  { display_name: "CI pipeline" },
  1234567,
  "Used by the nightly evaluation jobs",
);

/** A key whose display name is only whitespace and which has no usage yet. */
export const unusedApiKey = makeApiKey(
  "scratch-key",
  { display_name: "  " },
  null,
);
