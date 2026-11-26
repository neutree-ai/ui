import { FieldValue } from "@/foundation/type/FieldValue";
import { upgradeTargetVersion } from "../lib/upgrade-versions";
import type { Cluster } from "../types";
import { ClusterUpgradeTip } from "./ClusterUpgradeTip";

/** The running version, then the upgrade target while upgrading, else the newer-version tip. */
export function ClusterVersion({ cluster }: { cluster: Cluster }) {
  const target = upgradeTargetVersion(cluster);
  return (
    <span className="inline-flex min-w-0 items-center">
      <FieldValue value={cluster.status?.version} />
      {target ? (
        <span className="text-muted-foreground"> &rarr; {target}</span>
      ) : (
        <ClusterUpgradeTip cluster={cluster} />
      )}
    </span>
  );
}
