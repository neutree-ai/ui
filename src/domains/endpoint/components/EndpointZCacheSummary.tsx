import { ArrowRight, Database } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Switch } from "@/components/ui/switch";
import type { Cluster } from "@/domains/cluster/types";
import type { Endpoint } from "../types";

export function EndpointZCacheSummary({ endpoint, cluster }: { endpoint: Endpoint; cluster?: Cluster }) {
  const { t } = useTranslation();
  const enabled = endpoint.spec.zcache?.enabled === true;
  const configured = cluster?.spec.zcache?.enabled === true;
  return (
    <section aria-label="ZCache" className="flex flex-wrap items-center gap-x-10 gap-y-4 rounded-lg border bg-card px-6 py-4 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="rounded-md bg-muted p-3 text-primary"><Database className="h-5 w-5" /></div>
        <span className="font-semibold">ZCache</span>
        <Switch aria-label="ZCache" checked={enabled} disabled className="disabled:opacity-100 disabled:cursor-default" />
      </div>
      {enabled && (
        <div className="border-l pl-10">
          <div className="text-xs font-medium text-muted-foreground">{t("endpoints.zcache.timeoutLabel")}</div>
          <div className="mt-1 text-sm font-semibold">{t("endpoints.zcache.timeoutValue", { seconds: endpoint.spec.zcache?.timeout_seconds ?? 5 })}</div>
        </div>
      )}
      {cluster && !configured && <span className="text-sm text-muted-foreground">{t("endpoints.zcache.clusterUnconfigured")}</span>}
      {configured && (
        <div className="ml-auto text-right">
          <Link className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline" to={`/${encodeURIComponent(endpoint.metadata.workspace ?? "default")}/clusters/show/${encodeURIComponent(cluster.metadata.name)}?section=zcache`}>
            {t("endpoints.zcache.viewCluster")}<ArrowRight className="h-4 w-4" />
          </Link>
          <div className="mt-1 text-xs text-muted-foreground">{cluster.metadata.name}</div>
        </div>
      )}
    </section>
  );
}
