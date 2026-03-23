import { useCustom } from "@refinedev/core";
import { compareVersions } from "compare-versions";
import { ArrowUpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Cluster } from "@/domains/cluster/types";
import { useTranslation } from "@/foundation/lib/i18n";

type AvailableVersionsResponse = {
  available_versions: string[];
};

/**
 * Shows a small upgrade icon with tooltip when a newer version is available.
 * Compares available versions against the cluster's spec.version and status.version
 * using semver comparison. Only renders when a strictly higher version exists.
 */
export function ClusterUpgradeTip({ cluster }: { cluster: Cluster }) {
  const { t } = useTranslation();

  const currentMax = (() => {
    const versions = [cluster.spec.version, cluster.status?.version].filter(
      (v): v is string => !!v,
    );
    if (versions.length === 0) return null;
    return versions.reduce((a, b) => {
      try {
        return compareVersions(a, b) >= 0 ? a : b;
      } catch {
        return a;
      }
    });
  })();

  const isRunning = cluster.status?.phase === "Running";

  const queryEnabled =
    isRunning &&
    !!currentMax &&
    !!cluster.metadata.workspace &&
    !!cluster.spec.image_registry &&
    !!cluster.spec.type;

  const { data } = useCustom<AvailableVersionsResponse>({
    url: queryEnabled
      ? `/clusters/available_versions?${new URLSearchParams({
          workspace: cluster.metadata.workspace ?? "",
          image_registry: cluster.spec.image_registry,
          cluster_type: cluster.spec.type,
        }).toString()}`
      : "",
    method: "get",
    queryOptions: {
      enabled: queryEnabled,
      staleTime: 5 * 60 * 1000,
    },
  });

  const hasNewer = (() => {
    if (!currentMax || !data?.data?.available_versions) return false;
    return data.data.available_versions.some((v) => {
      try {
        return compareVersions(v, currentMax) > 0;
      } catch {
        return false;
      }
    });
  })();

  if (!hasNewer) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center ml-1.5 text-blue-600 cursor-default">
            <ArrowUpCircle size={14} />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{t("clusters.messages.newVersionAvailable")}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
