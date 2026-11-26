import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { badgeVariants } from "@/components/ui/badge";
import { endpointKVCacheSummary } from "@/domains/endpoint/lib/endpoint-display-show";
import { Section } from "@/foundation/scene/Section";
import type { Endpoint, EndpointClusterRef } from "../types";

export function EndpointKVCacheSummary({
  endpoint,
  cluster,
}: {
  endpoint: Endpoint;
  cluster?: EndpointClusterRef;
}) {
  const { t } = useTranslation();
  const summary = endpointKVCacheSummary(endpoint, cluster);
  if (!summary) return null;
  return (
    <Section
      title={
        <span className="inline-flex flex-wrap items-center gap-2">
          {t("endpoints.kvCacheSettings.enable")}
          <span className={badgeVariants({ variant: "secondary" })}>
            {t(
              summary.enabled
                ? "common.options.enabled"
                : "common.options.disabled",
            )}
          </span>
        </span>
      }
      description={
        <span className="inline-flex flex-wrap items-baseline gap-x-2">
          {summary.enabled ? (
            <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
              {t("endpoints.kvCacheSettings.timeoutLabel")}
              <span className="font-semibold text-foreground">
                {t("endpoints.kvCacheSettings.timeoutValue", {
                  seconds: summary.timeoutSeconds,
                })}
              </span>
            </span>
          ) : (
            <span>{t("endpoints.kvCacheSettings.endpointDisabled")}</span>
          )}
        </span>
      }
      actions={
        <div className="text-right">
          <Link
            className="inline-flex items-center gap-2 whitespace-nowrap text-sm font-medium text-primary hover:underline"
            to={summary.clusterCacheHref}
          >
            {t("endpoints.kvCacheSettings.viewCluster")}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <div className="mt-1 max-w-64 break-all text-xs text-muted-foreground">
            {summary.clusterName}
          </div>
        </div>
      }
      contentClassName="h-3 p-0"
    />
  );
}
