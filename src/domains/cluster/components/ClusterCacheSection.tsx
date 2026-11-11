import { useCan } from "@refinedev/core";
import { Settings2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { zcacheSpec, zcacheStatus } from "@/domains/cluster/types";
import { EmptyValue } from "@/foundation/components/EmptyValue";
import EndpointStatus from "@/foundation/components/EndpointStatus";
import { Link } from "@/foundation/components/Link";
import { MetricBar } from "@/foundation/components/MetricBar";
import { ShowPage } from "@/foundation/components/ShowPage";
import Timestamp from "@/foundation/components/Timestamp";
import { useSystemApi } from "@/foundation/hooks/use-system-api";
import type { NodeL1CacheUsage } from "@/foundation/lib/accelerator-observations";
import { formatToDecimal } from "@/foundation/lib/unit";
import {
  type CacheEndpointCandidate,
  cacheEndpointRefs,
} from "../lib/cache-endpoints";
import {
  cacheMessage,
  operationLabel,
  resolveZCacheState,
} from "../lib/zcache-presentation";
import type { Cluster } from "../types";
import { CacheRetry } from "./CacheRetry";
import { ZCacheActivity } from "./ZCacheActivity";
import { ZCacheEditor } from "./ZCacheEditor";
import { ZCacheUpgrade } from "./ZCacheUpgrade";

export function ClusterCacheSection({
  cluster,
  l1CacheByNode,
  endpoints = [],
  endpointsLoading = false,
  endpointsError = false,
}: {
  cluster: Cluster;
  l1CacheByNode?: Record<string, NodeL1CacheUsage>;
  endpoints?: CacheEndpointCandidate[];
  endpointsLoading?: boolean;
  endpointsError?: boolean;
}) {
  const { systemInfo } = useSystemApi();
  const available =
    systemInfo?.capabilities?.cluster_cache_providers?.includes("zcache") ===
    true;
  return available ? (
    <ZCacheDetails
      cluster={cluster}
      l1CacheByNode={l1CacheByNode}
      endpoints={endpoints}
      endpointsLoading={endpointsLoading}
      endpointsError={endpointsError}
    />
  ) : null;
}

function ZCacheDetails({
  cluster,
  l1CacheByNode,
  endpoints,
  endpointsLoading,
  endpointsError,
}: {
  cluster: Cluster;
  l1CacheByNode?: Record<string, NodeL1CacheUsage>;
  endpoints: CacheEndpointCandidate[];
  endpointsLoading: boolean;
  endpointsError: boolean;
}) {
  const { t } = useTranslation();
  const { data: access } = useCan({ resource: "clusters", action: "edit" });
  const [history, setHistory] = useState(false);
  const [editing, setEditing] = useState(false);
  const status = zcacheStatus(cluster);
  const summary = cluster.status?.cache;
  const desired = zcacheSpec(cluster);
  const state = resolveZCacheState({ desired, status, summary });
  const { activeChange: busy, availability, phase, resultLabelKey } = state;
  const { stale } = state;
  const nodes = status?.nodes ?? [];
  const targetNodes = desired?.enabled ? desired.target_nodes : [];
  const names = [...new Set([...nodes.map((n) => n.name), ...targetNodes])];
  const ready = nodes.filter((n) => n.runtime === "Ready").length;
  const request = busy?.request;
  const cp = status?.control_plane;
  const cacheEndpoints = useMemo(
    () => cacheEndpointRefs(endpoints, cluster.metadata?.workspace),
    [cluster.metadata?.workspace, endpoints],
  );
  return (
    <ShowPage.Section
      title={
        <span className="flex items-center gap-3">
          {t("clusters.cache.title")}
          <Badge variant={phase === "Failed" ? "destructive" : "secondary"}>
            {t(resultLabelKey)}
          </Badge>
        </span>
      }
      actions={
        <div className="flex gap-2">
          {(phase === "Failed" || (cp?.health_message && !cp.ready)) && (
            <CacheRetry cluster={cluster} />
          )}
          <Button
            size="sm"
            disabled={access?.can !== true}
            onClick={() => setEditing(true)}
          >
            <Settings2 className="mr-2 h-4 w-4" />
            {t("clusters.zcache.edit")}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <ZCacheUpgrade cluster={cluster} />
        {phase === "Unavailable" && (
          <p
            role="alert"
            className="rounded-md bg-destructive/5 p-3 text-sm text-destructive"
          >
            {cacheMessage(
              summary?.error_message,
              t("clusters.zcache.serviceName"),
            ) || t("clusters.zcache.stale")}
          </p>
        )}
        {phase === "Failed" && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-destructive/5 p-3 text-sm text-destructive"
          >
            <span>
              {t("clusters.zcache.failureHint")}
              {availability === "available" &&
                ` · ${t("clusters.zcache.stillAvailable")}`}
            </span>
            <Button variant="ghost" size="sm" onClick={() => setHistory(true)}>
              {t("clusters.zcache.viewReason")}
            </Button>
          </div>
        )}
        {phase === "Reconciling" && (
          <div
            role="status"
            className="space-y-1 rounded-md bg-primary/5 p-3 text-sm leading-6"
          >
            <p className="font-medium text-primary">
              {busy
                ? t("clusters.zcache.executing", {
                    action: t(operationLabel(request?.operation?.kind)),
                  })
                : t("clusters.zcache.waiting")}
              {request?.operation?.kind === "update_cache" &&
              request.lmcache?.l1SizeGb
                ? ` · L1 ${request.lmcache.l1SizeGb} GiB`
                : ""}
            </p>
            <p className="text-muted-foreground">
              {desired?.enabled
                ? t("clusters.zcache.latestTarget", {
                    size: desired.l1_size_gib,
                    count: targetNodes.length,
                  })
                : t("clusters.zcache.stopping")}
            </p>
            {busy && (
              <p className="text-muted-foreground">
                {t("clusters.zcache.editWhileBusy")}
              </p>
            )}
          </div>
        )}
        {(phase !== "Disabled" || names.length > 0) && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {stale
                ? t("clusters.zcache.lastObservation")
                : t("clusters.zcache.readyCount", {
                    ready,
                    total: names.length,
                  })}
            </span>
            {status?.observed_at && (
              <span>
                {t("clusters.zcache.observedAt")}{" "}
                <Timestamp timestamp={status.observed_at} />
              </span>
            )}
          </div>
        )}
        {names.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-3 pr-6 font-medium">
                    {t("clusters.zcache.node")}
                  </th>
                  <th className="pb-3 pr-6 font-medium">
                    {t("clusters.zcache.runtime")}
                  </th>
                  <th className="pb-3 font-medium">
                    {t("clusters.zcache.reportedCapacity")}
                  </th>
                  <th className="pb-3 pl-6 font-medium">
                    {t("clusters.zcache.usedBy")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {names.map((name) => {
                  const node = nodes.find((n) => n.name === name);
                  const target = targetNodes.includes(name);
                  const nodeEndpoints = cacheEndpoints.filter((endpoint) =>
                    endpoint.nodes.includes(name),
                  );
                  const usage = l1CacheByNode?.[name];
                  const usedGiB = !stale ? usage?.usedGiB : null;
                  const capacityGiB =
                    usage?.capacityGiB ??
                    (node && node.capacity_bytes > 0
                      ? node.capacity_bytes / 2 ** 30
                      : null);
                  const percent =
                    usedGiB != null && capacityGiB != null && capacityGiB > 0
                      ? Math.round(
                          Math.min(
                            100,
                            Math.max(0, (usedGiB / capacityGiB) * 100),
                          ),
                        )
                      : null;
                  const usedLabel =
                    usedGiB != null ? formatToDecimal(usedGiB, 1) : null;
                  const capacityLabel =
                    capacityGiB != null
                      ? formatToDecimal(capacityGiB, 0)
                      : null;
                  return (
                    <tr key={name} className="border-b last:border-0">
                      <td className="py-3 pr-6">
                        <span className="whitespace-nowrap">{name}</span>
                        {node?.reason && node.runtime !== "Ready" && (
                          <details className="mt-1 text-xs text-muted-foreground">
                            <summary className="cursor-pointer">
                              {t("clusters.zcache.viewReason")}
                            </summary>
                            <p className="mt-1 max-w-xl break-words">
                              {cacheMessage(
                                node.reason,
                                t("clusters.zcache.serviceName"),
                              )}
                            </p>
                          </details>
                        )}
                      </td>
                      <td className="whitespace-nowrap py-3 pr-6">
                        {t(
                          stale
                            ? "clusters.zcache.unknown"
                            : !node
                              ? "clusters.zcache.pendingNode"
                              : node.runtime === "Ready"
                                ? "clusters.zcache.ready"
                                : "clusters.zcache.notReady",
                        )}
                        {!target && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {t("clusters.zcache.removingNode")}
                          </p>
                        )}
                      </td>
                      <td className="min-w-56 py-3 tabular-nums">
                        {usedLabel && capacityLabel ? (
                          <div className="flex max-w-64 items-baseline justify-between gap-3">
                            <span>
                              {usedLabel} / {capacityLabel} GiB
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {percent}%
                            </span>
                          </div>
                        ) : capacityLabel ? (
                          <span>{capacityLabel} GiB</span>
                        ) : (
                          "—"
                        )}
                        {capacityLabel && (
                          <MetricBar
                            value={percent}
                            size="sm"
                            series="blue"
                            track={percent == null ? "unavailable" : "subtle"}
                            aria-label={
                              percent == null
                                ? t("clusters.zcache.usageUnavailableAria", {
                                    node: name,
                                    capacity: capacityLabel,
                                  })
                                : t("clusters.zcache.usageAria", {
                                    node: name,
                                    used: usedLabel,
                                    capacity: capacityLabel,
                                    percent,
                                  })
                            }
                            className="mt-2 max-w-64"
                          />
                        )}
                        {target &&
                          desired &&
                          (!node ||
                            node.capacity_bytes / 2 ** 30 !==
                              desired.l1_size_gib) && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {t("clusters.zcache.nodeTarget", {
                                size: desired.l1_size_gib,
                              })}
                            </p>
                          )}
                      </td>
                      <td className="min-w-56 py-3 pl-6">
                        {endpointsLoading ? (
                          <span className="text-xs text-muted-foreground">
                            {t("loading")}
                          </span>
                        ) : endpointsError ? (
                          <span className="text-xs text-destructive">
                            {t("clusters.zcache.dependencyCheckFailed")}
                          </span>
                        ) : nodeEndpoints.length > 0 ? (
                          <div className="flex flex-col gap-2">
                            {nodeEndpoints.map((endpoint) => (
                              <div
                                key={endpoint.key}
                                className="flex flex-wrap items-center gap-2"
                              >
                                {endpoint.name ? (
                                  <Link
                                    href={`/${encodeURIComponent(endpoint.workspace)}/endpoints/show/${encodeURIComponent(endpoint.name)}`}
                                    className="break-all text-sm font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/15"
                                  >
                                    {endpoint.label}
                                  </Link>
                                ) : (
                                  <span className="break-all text-sm font-medium">
                                    {endpoint.label}
                                  </span>
                                )}
                                <EndpointStatus {...(endpoint.status ?? {})} />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <EmptyValue />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-3 text-sm text-muted-foreground">
            {t(
              desired?.enabled
                ? "clusters.zcache.noRuntimeNodes"
                : "clusters.zcache.disabledHint",
            )}
          </p>
        )}
        {!endpointsLoading && !endpointsError && cacheEndpoints.length > 0 && (
          <p className="text-xs leading-5 text-muted-foreground">
            {t("clusters.zcache.dependencyDetailHint")}
          </p>
        )}
      </div>
      {editing && (
        <ZCacheEditor cluster={cluster} onClose={() => setEditing(false)} />
      )}
      <ZCacheActivity
        summary={summary}
        status={status}
        open={history}
        onOpenChange={setHistory}
      />
    </ShowPage.Section>
  );
}
