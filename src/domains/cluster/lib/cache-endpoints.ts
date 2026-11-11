import type { BaseStatus } from "@/foundation/types/basic-types";
import type { EndpointResourceStatus } from "@/foundation/types/resource-types";

export type CacheEndpointCandidate = {
  id: number;
  metadata?: {
    name?: string;
    display_name?: string | null;
    workspace?: string | null;
  };
  spec: { kv_cache?: { provider: string } | null };
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

/** Endpoints that depend on this cluster's cache configuration.
 *
 * The dependency exists at cluster scope: an Endpoint can declare the cache
 * provider before the runtime reports it in use. Preserve either signal so the
 * details and editor show the same set used by removal guards.
 */
export function cacheEndpointRefs(
  endpoints: CacheEndpointCandidate[],
  fallbackWorkspace?: string | null,
): CacheEndpointRef[] {
  return endpoints
    .filter(
      (endpoint) =>
        endpoint.spec.kv_cache?.provider === "zcache" ||
        (endpoint.status?.kv_cache?.provider === "zcache" &&
          endpoint.status.kv_cache.details?.in_use === true),
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
        if (!existing.status && endpoint.status)
          existing.status = endpoint.status;
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
