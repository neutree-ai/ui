import type { NodeL1CacheUsage } from "@/foundation/accelerator/accelerator-observations";
import { formatToDecimal } from "@/foundation/role/unit";
import type { ZCacheSpec, ZCacheStatus } from "../types";

type CacheNode = NonNullable<ZCacheStatus["nodes"]>[number];
type NodeRuntime = "ready" | "notReady" | "eligible" | "unavailable";

const CONTROL_PLANE_REASON =
  "control-plane nodes are not used for the ZCache runtime by default";

const isReady = (node?: CacheNode) => node?.runtime === "Ready";

/** A node's reported L1 capacity in GiB; null when it reports none. */
const reportedGiB = (node?: CacheNode) =>
  node && node.capacity_bytes > 0 ? node.capacity_bytes / 2 ** 30 : null;

const gibLabel = (gib: number | null | undefined, precision: number) =>
  gib == null ? null : formatToDecimal(gib, precision);

export const readyNodeCount = (status?: ZCacheStatus) =>
  (status?.nodes ?? []).filter(isReady).length;

/**
 * The editor's node rows: every candidate plus every selected node. Only
 * nodes the cache service has applied (`saved` until it reports any) are
 * locked while the cache is in use; a saved node that never took effect can
 * be withdrawn (mirrors the database guard). No node can be added from a
 * failed observation. A provider reason is shown through `cacheMessage`,
 * the control-plane one as `reasonKey`.
 */
export function zcacheNodeChoices(
  status: ZCacheStatus | undefined,
  draft: { selected: string[]; saved: string[]; guardRemoval: boolean },
) {
  const { selected, saved, guardRemoval } = draft;
  const candidates = status?.candidates ?? [];
  const applied = status?.current?.target_nodes ?? saved;
  const names = new Set([...candidates.map((node) => node.name), ...selected]);
  return [...names].map((name) => {
    const candidate = candidates.find((node) => node.name === name);
    const node = status?.nodes?.find((node) => node.name === name);
    const selectable = !!candidate?.selectable && !status?.observation_error;
    const runtime: NodeRuntime = node
      ? isReady(node)
        ? "ready"
        : "notReady"
      : candidate?.selectable
        ? "eligible"
        : "unavailable";
    const controlPlane =
      !node?.reason && candidate?.reason === CONTROL_PLANE_REASON;
    return {
      name,
      runtime,
      reasonKey: controlPlane
        ? "clusters.zcache.kubernetesControlPlane"
        : undefined,
      reason: controlPlane ? undefined : node?.reason || candidate?.reason,
      capacityGiB: gibLabel(reportedGiB(node), 0),
      selected: selected.includes(name),
      applied: applied.includes(name),
      locked:
        (guardRemoval && applied.includes(name)) ||
        (!selected.includes(name) && !selectable),
    };
  });
}

/**
 * The detail rows: every reported node plus every desired target node. A
 * stale observation reports neither readiness nor usage; capacity prefers
 * the metrics' figure over the provider's report. `targetGiB` is the desired
 * per-node capacity while a target node does not report it; a node outside
 * the targets is being removed.
 */
export function zcacheNodeDetails(
  desired: ZCacheSpec | undefined,
  status: ZCacheStatus | undefined,
  stale: boolean,
  usageByNode?: Record<string, NodeL1CacheUsage>,
) {
  const targets = desired?.enabled ? desired.target_nodes : [];
  const reported = status?.nodes ?? [];
  const names = new Set([...reported.map((node) => node.name), ...targets]);
  return [...names].map((name) => {
    const node = reported.find((node) => node.name === name);
    const target = targets.includes(name);
    const used = stale ? null : usageByNode?.[name]?.usedGiB;
    const capacity = usageByNode?.[name]?.capacityGiB ?? reportedGiB(node);
    const percent =
      used != null && capacity != null && capacity > 0
        ? Math.round(Math.min(100, Math.max(0, (used / capacity) * 100)))
        : null;
    const runtimeKey = stale
      ? "unknown"
      : !node
        ? "pendingNode"
        : isReady(node)
          ? "ready"
          : "notReady";
    return {
      name,
      runtimeKey: `clusters.zcache.${runtimeKey}`,
      reason: isReady(node) ? undefined : node?.reason,
      target,
      usedLabel: gibLabel(used, 1),
      capacityLabel: gibLabel(capacity, 0),
      percent,
      targetGiB:
        target &&
        desired &&
        (!node || node.capacity_bytes / 2 ** 30 !== desired.l1_size_gib)
          ? desired.l1_size_gib
          : undefined,
    };
  });
}
