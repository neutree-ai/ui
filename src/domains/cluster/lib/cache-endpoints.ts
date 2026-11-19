import type { BaseStatus } from "@/foundation/types/basic-types";
import type { EndpointResourceStatus } from "@/foundation/types/resource-types";

export type CacheEndpointCandidate = {
  id: number;
  metadata?: {
    name?: string;
    display_name?: string | null;
    workspace?: string | null;
  };
  status?:
    | (BaseStatus & {
        kv_cache?: {
          provider: string;
          details?: Record<string, unknown> | null;
        } | null;
        resources?: EndpointResourceStatus | null;
      })
    | null;
};

export type CacheEndpointRef = {
  key: string;
  label: string;
  name?: string;
  workspace: string;
  status: BaseStatus | null;
  nodes: string[];
};

/** Endpoints actively using this cluster's cache runtime.
 *
 * Matches backend admission (`status.kv_cache.details.in_use === true`):
 * paused or unscheduled Endpoints without running Pods do not block cache node
 * removal or disabling cluster cache, while terminating Pods still do.
 */
export function cacheEndpointRefs(
  endpoints: CacheEndpointCandidate[],
  fallbackWorkspace?: string | null,
): CacheEndpointRef[] {
  return endpoints
    .filter(
      (endpoint) =>
        endpoint.status?.kv_cache?.provider === "zcache" &&
        endpoint.status.kv_cache.details?.in_use === true,
    )
    .reduce<CacheEndpointRef[]>((refs, endpoint) => {
      const name = endpoint.metadata?.name;
      const workspace =
        endpoint.metadata?.workspace || fallbackWorkspace || "default";
      const key = name ? `${workspace}/${name}` : `endpoint-${endpoint.id}`;
      const nodes = [
        ...new Set(
          (endpoint.status?.resources?.replicas ?? []).flatMap((replica) => [
            replica.node_id,
            ...(replica.devices ?? []).map((device) => device.node_id),
          ]),
        ),
      ].filter((node): node is string => !!node);
      const existing = refs.find((ref) => ref.key === key);
      if (existing) {
        existing.nodes = [...new Set([...existing.nodes, ...nodes])];
        return refs;
      }

      refs.push({
        key,
        label: endpoint.metadata?.display_name || name || String(endpoint.id),
        name,
        workspace,
        status: endpoint.status ?? null,
        nodes,
      });
      return refs;
    }, []);
}
