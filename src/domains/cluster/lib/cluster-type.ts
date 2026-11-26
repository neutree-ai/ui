import type { SystemInfo } from "@/foundation/types/system-types";

type WithType = { spec?: { type?: string } } | null | undefined;

export const isSshCluster = (cluster: WithType) =>
  cluster?.spec?.type === "ssh";

export const isKubernetesCluster = (cluster: WithType) =>
  cluster?.spec?.type === "kubernetes";

/** The cache tab and editor need a Kubernetes cluster and the zcache provider on the control plane. */
export function supportsZCache(
  cluster: WithType,
  systemInfo: SystemInfo | undefined,
): boolean {
  return (
    isKubernetesCluster(cluster) &&
    systemInfo?.capabilities?.cluster_cache_providers?.includes("zcache") ===
      true
  );
}
