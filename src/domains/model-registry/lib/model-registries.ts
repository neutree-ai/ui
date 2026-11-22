import { REST_URL } from "@/foundation/lib/api";
import { authHeaders, errorFrom } from "@/foundation/lib/api/registry-models";

/**
 * Registry-level routes that are not PostgREST tables.
 *
 * A registry itself is a table and goes through the data provider; the action
 * below is a server-side operation on one, so it is a plain `fetch` like the
 * models sub-API beside it — whose auth headers and error decoding it shares,
 * because the failures come back in the same shapes.
 */

/**
 * What a connection check found. The registry being unreachable is an outcome,
 * not a failure: the route answers `200` with `phase: "Failed"` and the reason,
 * so an error from this call means the *check* could not be run.
 */
export type ModelRegistryConnectionCheck = {
  phase: string;
  error_message?: string;
  last_checked_at?: string;
  last_transition_time?: string;
};

/**
 * Checks a registry now and reports what it found.
 *
 * The control plane already retries a failed registry on every reconcile, so
 * this is not how a registry recovers. What it uniquely does is **drop the
 * server's cached query results for this registry** — without that, a registry
 * fixed a moment ago goes green while the listing beside it keeps replaying
 * pre-fix answers, which reads as the fix not having worked. Callers must
 * therefore refetch the listing on success, not just the status.
 */
export async function retryModelRegistryConnection(
  workspace: string,
  registry: string,
): Promise<ModelRegistryConnectionCheck> {
  const res = await fetch(
    `${REST_URL}/workspaces/${encodeURIComponent(
      workspace,
    )}/model_registries/${encodeURIComponent(registry)}/retry_connection`,
    { method: "POST", headers: authHeaders() },
  );

  if (!res.ok) {
    throw await errorFrom(res);
  }

  return (await res.json()) as ModelRegistryConnectionCheck;
}
