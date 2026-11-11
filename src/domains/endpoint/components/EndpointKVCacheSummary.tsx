import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { badgeVariants } from "@/components/ui/badge";
import { endpointZCacheOptions } from "@/domains/endpoint/lib/zcache";
import { Section } from "@/foundation/components/Section";
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
  if (!configured || (endpoint.spec.kv_cache && !enabled)) return null;
  return (
    <Section
      title={
        <span className="inline-flex flex-wrap items-center gap-2">
          {t("endpoints.kvCacheSettings.enable")}
          <span className={badgeVariants({ variant: "secondary" })}>
            {t(enabled ? "common.options.enabled" : "common.options.disabled")}
          </span>
        </span>
      }
      description={
        <span className="inline-flex flex-wrap items-baseline gap-x-2">
          {enabled ? (
            <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
              {t("endpoints.kvCacheSettings.timeoutLabel")}
              <span className="font-semibold text-foreground">
                {t("endpoints.kvCacheSettings.timeoutValue", {
                  seconds:
                    endpoint.spec.kv_cache?.options?.timeout_seconds ?? 5,
                })}
              </span>
            </span>
          ) : (
            <span>{t("endpoints.kvCacheSettings.endpointDisabled")}</span>
          )}
        </span>
      }
      actions={
        cluster ? (
          <div className="text-right">
            <Link
              className="inline-flex items-center gap-2 whitespace-nowrap text-sm font-medium text-primary hover:underline"
              to={`/${encodeURIComponent(endpoint.metadata.workspace ?? "default")}/clusters/show/${encodeURIComponent(cluster.metadata.name)}?section=cache`}
            >
              {t("endpoints.kvCacheSettings.viewCluster")}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <div className="mt-1 max-w-64 break-all text-xs text-muted-foreground">
              {cluster.metadata.name}
            </div>
          </div>
        ) : undefined
      }
      contentClassName="h-3 p-0"
    />
  );
}
