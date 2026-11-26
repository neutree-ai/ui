import { useCan } from "@refinedev/core";
import { Settings2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { zcacheSpec, zcacheStatus } from "@/domains/cluster/types";
import type { NodeL1CacheUsage } from "@/foundation/accelerator/accelerator-observations";
import { endpointHref } from "@/foundation/accelerator/accelerator-observations";
import { Link } from "@/foundation/components/Link";
import { endpointPhases } from "@/foundation/endpoint-phase/endpoint-phases";
import { useSystemApi } from "@/foundation/hooks/use-system-api";
import { MetricBar } from "@/foundation/role/MetricBar";
import { PhaseStatus } from "@/foundation/role/PhaseStatus";
import Timestamp from "@/foundation/role/Timestamp";
import { ShowPage } from "@/foundation/scene/ShowPage";
import { EmptyValue } from "@/foundation/type/EmptyValue";
import {
  type CacheEndpointCandidate,
  cacheEndpointRefs,
} from "../lib/cache-endpoints";
import { readyNodeCount, zcacheNodeDetails } from "../lib/zcache-nodes";
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
  const { stale, desiredEnabled, changeCapacityGiB } = state;
  const rows = zcacheNodeDetails(desired, status, stale, l1CacheByNode);
  const workspace = cluster.metadata?.workspace;
  const cacheEndpoints = useMemo(
    () => cacheEndpointRefs(endpoints, workspace),
    [workspace, endpoints],
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
          {state.retryable && <CacheRetry cluster={cluster} />}
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
                    action: t(operationLabel(busy.request?.operation?.kind)),
                  })
                : t("clusters.zcache.waiting")}
              {changeCapacityGiB ? ` · L1 ${changeCapacityGiB} GiB` : ""}
            </p>
            <p className="text-muted-foreground">
              {desiredEnabled && desired
                ? t("clusters.zcache.latestTarget", {
                    size: desired.l1_size_gib,
                    count: desired.target_nodes.length,
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
        {(phase !== "Disabled" || rows.length > 0) && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {stale
                ? t("clusters.zcache.lastObservation")
                : t("clusters.zcache.readyCount", {
                    ready: readyNodeCount(status),
                    total: rows.length,
                  })}
            </span>
            {/* ddu-override: the observed-at line only appears once an observation exists */}
            {status?.observed_at && (
              <span>
                {t("clusters.zcache.observedAt")}{" "}
                <Timestamp timestamp={status.observed_at} />
              </span>
            )}
          </div>
        )}
        {rows.length > 0 ? (
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
                {rows.map((row) => {
                  const { name, capacityLabel, usedLabel, percent } = row;
                  const nodeEndpoints = cacheEndpoints.filter((endpoint) =>
                    endpoint.nodes.includes(name),
                  );
                  return (
                    <tr key={name} className="border-b last:border-0">
                      <td className="py-3 pr-6">
                        <span className="whitespace-nowrap">{name}</span>
                        {row.reason && (
                          <details className="mt-1 text-xs text-muted-foreground">
                            <summary className="cursor-pointer">
                              {t("clusters.zcache.viewReason")}
                            </summary>
                            <p className="mt-1 max-w-xl break-words">
                              {cacheMessage(
                                row.reason,
                                t("clusters.zcache.serviceName"),
                              )}
                            </p>
                          </details>
                        )}
                      </td>
                      <td className="whitespace-nowrap py-3 pr-6">
                        {t(row.runtimeKey)}
                        {!row.target && (
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
                        {row.targetGiB !== undefined && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {t("clusters.zcache.nodeTarget", {
                              size: row.targetGiB,
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
                                    href={endpointHref({
                                      workspace: endpoint.workspace,
                                      endpoint: endpoint.name,
                                    })}
                                    className="break-all text-sm font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/15"
                                  >
                                    {endpoint.label}
                                  </Link>
                                ) : (
                                  <span className="break-all text-sm font-medium">
                                    {endpoint.label}
                                  </span>
                                )}
                                <PhaseStatus
                                  status={endpoint.status}
                                  phases={endpointPhases}
                                />
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
              desiredEnabled
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
