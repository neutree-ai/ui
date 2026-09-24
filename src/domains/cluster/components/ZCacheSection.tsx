import { useTranslation } from "react-i18next";
import { ShowPage } from "@/foundation/components/ShowPage";
import Timestamp from "@/foundation/components/Timestamp";
import type { Cluster } from "../types";

export function ZCacheSection({ cluster }: { cluster: Cluster }) {
  const { t } = useTranslation();
  const status = cluster.status?.zcache;
  const nodes = status?.nodes ?? [];
  const ready = nodes.filter((n) => n.runtime === "Ready").length;
  const phase = status?.phase ?? "Reconciling";
  const result = t(
    phase === "Applied"
      ? "clusters.zcache.applied"
      : phase === "Failed"
        ? "clusters.zcache.failed"
        : "clusters.zcache.reconciling",
  );
  return (
    <ShowPage.Section title={t("clusters.zcache.title")}>
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <ShowPage.Row title={t("clusters.zcache.configurationResult")}>
            {result}
          </ShowPage.Row>
          <ShowPage.Row title={t("clusters.zcache.desired")}>
            {cluster.spec.zcache?.enabled
              ? `${cluster.spec.zcache.l1_size_gib} GiB · ${cluster.spec.zcache.target_nodes.length} ${t("clusters.zcache.nodes")}`
              : t("clusters.zcache.disabled")}
          </ShowPage.Row>
          <ShowPage.Row title={t("clusters.zcache.readyNodes")}>
            {status?.observed_at
              ? `${ready} / ${nodes.length}`
              : t("clusters.zcache.unknown")}
          </ShowPage.Row>
        </div>
        {status?.message && (
          <p role="status" className="text-sm">
            {status.message}
          </p>
        )}
        {status?.observation_error && (
          <p role="alert" className="text-sm text-destructive">
            {t("clusters.zcache.stale")} {status.observation_error}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          {t("clusters.zcache.observedAt")}{" "}
          {status?.observed_at ? (
            <Timestamp timestamp={status.observed_at} />
          ) : (
            t("clusters.zcache.unknown")
          )}
        </p>
        {nodes.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="p-2">{t("clusters.zcache.node")}</th>
                  <th className="p-2">{t("clusters.zcache.runtime")}</th>
                  <th className="p-2">
                    {t("clusters.zcache.reportedCapacity")}
                  </th>
                  <th className="p-2">{t("clusters.zcache.reason")}</th>
                </tr>
              </thead>
              <tbody>
                {nodes.map((n) => (
                  <tr key={n.name} className="border-b">
                    <td className="p-2">{n.name}</td>
                    <td className="p-2">
                      {t(
                        n.runtime === "Ready"
                          ? "clusters.zcache.ready"
                          : "clusters.zcache.notReady",
                      )}
                    </td>
                    <td className="p-2">
                      {n.capacity_bytes > 0
                        ? `${n.capacity_bytes / 2 ** 30} GiB`
                        : "—"}
                    </td>
                    <td className="p-2">{n.reason || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("clusters.zcache.noRuntimeNodes")}
          </p>
        )}
        <h3 className="font-medium">{t("clusters.zcache.operations")}</h3>
        {status?.change && (
          <p className="text-sm">
            {t("clusters.zcache.submission")}{" "}
            {status.change.operation_id || t("clusters.zcache.notAccepted")}
            {status.change.message && ` · ${status.change.message}`}
          </p>
        )}
        {(status?.operations ?? []).map((op) => (
          <details key={op.id} className="rounded-md border p-3">
            <summary className="cursor-pointer text-sm">
              {op.id} · {op.phase} · {op.kind}
            </summary>
            <div className="mt-2 space-y-2 text-sm">
              {op.created_at && <Timestamp timestamp={op.created_at} />}
              <p>{op.message}</p>
              {op.nodes?.map((node) => (
                <p key={node.name}>
                  {node.name} · {node.phase}
                  {node.reason && ` · ${node.reason}`}
                </p>
              ))}
            </div>
          </details>
        ))}
        {!status?.operations?.length && (
          <p className="text-sm text-muted-foreground">
            {t("clusters.zcache.noOperations")}
          </p>
        )}
      </div>
    </ShowPage.Section>
  );
}
