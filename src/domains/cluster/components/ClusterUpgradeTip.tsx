import { ArrowUpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Cluster } from "@/domains/cluster/types";
import { useTranslation } from "@/foundation/lib/i18n";
import { useAvailableVersions } from "../hooks/use-available-versions";
import {
  clusterVersionQuery,
  hasUpgradeVersion,
  isUpgradeable,
} from "../lib/upgrade-versions";

/** An upgrade icon with a tooltip when the upgrade dialog would offer a target. */
export function ClusterUpgradeTip({ cluster }: { cluster: Cluster }) {
  const { t } = useTranslation();
  const { versions } = useAvailableVersions(clusterVersionQuery(cluster), {
    enabled: isUpgradeable(cluster),
    staleTime: 5 * 60 * 1000,
  });

  if (!hasUpgradeVersion(cluster, versions)) return null;

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
