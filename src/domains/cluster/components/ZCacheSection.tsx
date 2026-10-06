import { useCan } from "@refinedev/core";
import { CircleAlert, CircleCheck, History, Settings2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { ShowPage } from "@/foundation/components/ShowPage";
import Timestamp from "@/foundation/components/Timestamp";
import { useSystemApi } from "@/foundation/hooks/use-system-api";
import {
  activeCacheChange,
  operationLabel,
  sameCacheConfig,
} from "../lib/zcache-presentation";
import type { Cluster } from "../types";
import { ZCacheActivity } from "./ZCacheActivity";
import { ZCacheControlPlane } from "./ZCacheControlPlane";
import { ZCacheEditor } from "./ZCacheEditor";

export function ZCacheSection({ cluster }: { cluster: Cluster }) {
  const { systemInfo } = useSystemApi();
  return systemInfo?.capabilities?.zcache === true ? (
    <ZCacheDetails cluster={cluster} />
  ) : null;
}

function ZCacheDetails({ cluster }: { cluster: Cluster }) {
  const { t } = useTranslation();
  const { data: access } = useCan({ resource: "clusters", action: "edit" });
  const [editing, setEditing] = useState(false);
  const [history, setHistory] = useState(false);
  const status = cluster.status?.zcache;
  const desired = cluster.spec.zcache;
  const nodes = status?.nodes ?? [];
  const targetNodes = desired?.enabled ? desired.target_nodes : [];
  const names = [...new Set([...nodes.map((n) => n.name), ...targetNodes])];
  const ready = nodes.filter((n) => n.runtime === "Ready").length;
  const matches = sameCacheConfig(desired, status?.current);
  const phase =
    status?.phase === "Applied" && !matches ? "Reconciling" : status?.phase;
  const stale = !!status?.observation_error || !status?.observed_at;
  const busy = activeCacheChange(status);
  const request = busy?.request;
  const cp = status?.control_plane;
  const ControlPlaneIcon = cp?.ready ? CircleCheck : CircleAlert;
  const cpPending =
    !!desired?.control_plane &&
    desired.control_plane.request_id !== cp?.request_id;
  const cpBusy =
    cpPending || cp?.phase === "Installing" || cp?.phase === "Upgrading";
  const resultKey = stale
    ? "clusters.zcache.unknown"
    : phase === "Failed"
      ? "clusters.zcache.failed"
      : phase !== "Applied"
        ? "clusters.zcache.reconciling"
        : desired?.enabled
          ? "clusters.zcache.applied"
          : "clusters.zcache.disabled";
  return (
    <ShowPage.Section
      title={
        <span className="flex items-center gap-3">
          {t("clusters.zcache.title")}
          <Badge variant={phase === "Failed" ? "destructive" : "secondary"}>
            {t(resultKey)}
          </Badge>
        </span>
      }
      actions={
        <div className="flex gap-2">
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
        {status?.observation_error && (
          <p
            role="alert"
            className="rounded-md bg-destructive/5 p-3 text-sm text-destructive"
          >
            {t("clusters.zcache.stale")}
          </p>
        )}
        {phase === "Failed" && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-destructive/5 p-3 text-sm text-destructive"
          >
            <span>{t("clusters.zcache.failureHint")}</span>
            <Button variant="ghost" size="sm" onClick={() => setHistory(true)}>
              {t("clusters.zcache.viewReason")}
            </Button>
          </div>
        )}
        {phase !== "Applied" && phase !== "Failed" && (
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
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            {stale
              ? t("clusters.zcache.lastObservation")
              : t("clusters.zcache.readyCount", { ready, total: names.length })}
          </span>
          {status?.observed_at && (
            <span>
              {t("clusters.zcache.observedAt")}{" "}
              <Timestamp timestamp={status.observed_at} />
            </span>
          )}
        </div>
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
                              {node.reason}
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
        <details className="border-t pt-3">
          <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2">
              <ControlPlaneIcon className="h-4 w-4 text-muted-foreground" />
              {t("clusters.zcache.controlPlane.title")}
              <span
                className={
                  !cp?.ready || cpBusy
                    ? "text-amber-600"
                    : "text-muted-foreground"
                }
              >
                {t(
                  cpBusy
                    ? "clusters.zcache.reconciling"
                    : !cp
                      ? "clusters.zcache.unknown"
                      : cp.ready
                        ? "clusters.zcache.ready"
                        : "clusters.zcache.notReady",
                )}
              </span>
              {cp?.phase === "Failed" && (
                <Badge variant="destructive">
                  {t("clusters.zcache.controlPlane.failed")}
                </Badge>
              )}
            </span>
            <span className="text-primary">
              {t("clusters.zcache.maintenance")}
            </span>
          </summary>
          <div className="mt-4">
            <ZCacheControlPlane cluster={cluster} />
            <p className="mt-3 text-xs text-muted-foreground">
              {t("clusters.zcache.configuredVersion")}:{" "}
              {status?.configured_runtime_version ||
                t("clusters.zcache.unknown")}
            </p>
          </div>
        </details>
      </div>
      {editing && (
        <ZCacheEditor cluster={cluster} onClose={() => setEditing(false)} />
      )}
      <ZCacheActivity
        status={status}
        open={history}
        onOpenChange={setHistory}
      />
    </ShowPage.Section>
  );
}
