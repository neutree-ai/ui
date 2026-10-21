import { useCan } from "@refinedev/core";
import { History, Settings2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { zcacheSpec, zcacheStatus } from "@/domains/cluster/types";
import { ShowPage } from "@/foundation/components/ShowPage";
import Timestamp from "@/foundation/components/Timestamp";
import { useSystemApi } from "@/foundation/hooks/use-system-api";
import {
  activeCacheChange,
  cacheMessage,
  operationLabel,
  sameCacheConfig,
} from "../lib/zcache-presentation";
import type { Cluster } from "../types";
import { CacheRetry } from "./CacheRetry";
import { ZCacheActivity } from "./ZCacheActivity";
import { ZCacheEditor } from "./ZCacheEditor";

export function ClusterCacheSection({ cluster }: { cluster: Cluster }) {
  const { systemInfo } = useSystemApi();
  return systemInfo?.capabilities?.cluster_cache_providers?.includes(
    "zcache",
  ) === true ? (
    <ZCacheDetails cluster={cluster} />
  ) : null;
}

function ZCacheDetails({ cluster }: { cluster: Cluster }) {
  const { t } = useTranslation();
  const { data: access } = useCan({ resource: "clusters", action: "edit" });
  const [editing, setEditing] = useState(false);
  const [history, setHistory] = useState(false);
  const status = zcacheStatus(cluster);
  const summary = cluster.status?.cache;
  const availability = summary?.conditions?.find((c) => c.type === "Ready");
  const desired = zcacheSpec(cluster);
  const nodes = status?.nodes ?? [];
  const targetNodes = desired?.enabled ? desired.target_nodes : [];
  const names = [...new Set([...nodes.map((n) => n.name), ...targetNodes])];
  const ready = nodes.filter((n) => n.runtime === "Ready").length;
  const matches = sameCacheConfig(desired, status?.current);
  const phase =
    (summary?.phase === "Ready" || summary?.phase === "Disabled") && !matches
      ? "Reconciling"
      : summary?.phase;
  const stale = availability?.status === "Unknown" || !status?.observed_at;
  const busy = activeCacheChange(status);
  const request = busy?.request;
  const cp = status?.control_plane;
  const resultKey =
    phase === "Failed"
      ? "clusters.zcache.failed"
      : phase === "Disabled"
        ? "clusters.zcache.disabled"
        : phase === "Ready"
          ? "clusters.zcache.applied"
          : phase === "Unavailable"
            ? availability?.status === "False"
              ? "clusters.zcache.unavailable"
              : "clusters.zcache.unknown"
            : "clusters.zcache.reconciling";
  return (
    <ShowPage.Section
      title={
        <span className="flex items-center gap-3">
          {t("clusters.cache.title")}
          <Badge variant={phase === "Failed" ? "destructive" : "secondary"}>
            {t(resultKey)}
          </Badge>
        </span>
      }
      actions={
        <div className="flex gap-2">
          {(phase === "Failed" || (cp?.health_message && !cp.ready)) && (
            <CacheRetry cluster={cluster} />
          )}
          <Button variant="ghost" size="sm" onClick={() => setHistory(true)}>
            <History className="mr-2 h-4 w-4" />
            {t("clusters.zcache.operations")}
          </Button>
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
              {availability?.status === "True" &&
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
                </tr>
              </thead>
              <tbody>
                {names.map((name) => {
                  const node = nodes.find((n) => n.name === name);
                  const target = targetNodes.includes(name);
                  return (
                    <tr key={name} className="border-b last:border-0">
                      <td className="py-3 pr-6">
                        <span className="break-all">{name}</span>
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
                      <td className="whitespace-nowrap py-3">
                        {node && node.capacity_bytes > 0
                          ? `${node.capacity_bytes / 2 ** 30} GiB`
                          : "—"}
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
        {status?.configured_runtime_version && (
          <p className="border-t pt-3 text-sm text-muted-foreground">
            {t("clusters.zcache.configuredVersion")}:{" "}
            {status.configured_runtime_version}
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
