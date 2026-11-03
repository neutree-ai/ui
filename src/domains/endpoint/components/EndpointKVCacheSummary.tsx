import { ArrowRight, Database } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Switch } from "@/components/ui/switch";
import { endpointZCacheOptions } from "@/domains/endpoint/lib/zcache";
import type { Endpoint, EndpointClusterRef } from "../types";

export function EndpointKVCacheSummary({
  endpoint,
  cluster,
}: {
  endpoint: Endpoint;
  cluster?: EndpointClusterRef;
}) {
  const { t } = useTranslation();
  const enabled = endpoint.spec.kv_cache?.provider === "zcache";
  const configured = endpointZCacheOptions(cluster)?.enabled === true;
  if (endpoint.spec.kv_cache && !enabled) return null;
  return (
    <section
      aria-label={t("endpoints.kvCacheSettings.enable")}
      className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-md border bg-muted/10 px-4 py-3"
    >
      <div className="flex items-center gap-4">
        <div className="rounded-md bg-muted p-2 text-muted-foreground">
          <Database className="h-4 w-4" />
        </div>
        <span className="font-semibold">
          {t("endpoints.kvCacheSettings.enable")}
        </span>
        <Switch
          aria-label={t("endpoints.kvCacheSettings.enable")}
          checked={enabled}
          disabled
          className="disabled:opacity-100 disabled:cursor-default"
        />
      </div>
      {!enabled && (
        <span className="text-sm text-muted-foreground">
          {t("endpoints.kvCacheSettings.endpointDisabled")}
        </span>
      )}
      {enabled && (
        <div className="border-l pl-8">
          <div className="text-xs font-medium text-muted-foreground">
            {t("endpoints.kvCacheSettings.timeoutLabel")}
          </div>
          <div className="mt-1 text-sm font-semibold">
            {t("endpoints.kvCacheSettings.timeoutValue", {
              seconds: endpoint.spec.kv_cache?.options?.timeout_seconds ?? 5,
            })}
          </div>
        </div>
      )}
      {cluster && !configured && (
        <span className="text-sm text-muted-foreground">
          {t("endpoints.kvCacheSettings.clusterUnconfigured")}
        </span>
      )}
      {cluster && configured && (
        <div className="ml-auto text-right">
          <Link
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            to={`/${encodeURIComponent(endpoint.metadata.workspace ?? "default")}/clusters/show/${encodeURIComponent(cluster.metadata.name)}?section=cache`}
          >
            {t("endpoints.kvCacheSettings.viewCluster")}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <div className="mt-1 text-xs text-muted-foreground">
            {cluster.metadata.name}
          </div>
        </div>
      )}
    </section>
  );
}
