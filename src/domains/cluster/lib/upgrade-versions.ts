import { compareVersions, validate } from "compare-versions";
import type { Cluster } from "../types";

export function isUpgradeVersion(
  candidate: string | null | undefined,
  currentSpecVersion: string | null | undefined,
): boolean {
  if (typeof candidate !== "string" || !validate(candidate)) return false;

  return (
    typeof currentSpecVersion !== "string" ||
    !validate(currentSpecVersion) ||
    compareVersions(candidate, currentSpecVersion) > 0
  );
}

export function getUpgradeVersions(
  candidates: readonly string[],
  currentSpecVersion: string | null | undefined,
): string[] {
  const validCandidates = [...new Set(candidates.filter(validate))].sort(
    compareVersions,
  );

  if (typeof currentSpecVersion !== "string" || !validate(currentSpecVersion)) {
    return validCandidates;
  }

  return validCandidates.filter((candidate) =>
    isUpgradeVersion(candidate, currentSpecVersion),
  );
}

export type ClusterVersionQuery = {
  workspace?: string | null;
  imageRegistry?: string | null;
  type?: string | null;
  acceleratorType?: string | null;
};

/** The versions a cluster of this shape can run; known once workspace, registry and type are. */
export function availableVersionsUrl(
  query: ClusterVersionQuery,
): string | undefined {
  const { workspace, imageRegistry, type, acceleratorType } = query;
  if (!workspace || !imageRegistry || !type) return undefined;
  const params = new URLSearchParams({
    workspace,
    image_registry: imageRegistry,
    cluster_type: type,
  });
  if (acceleratorType) params.set("accelerator_type", acceleratorType);
  return `/clusters/available_versions?${params.toString()}`;
}

/** The lookup for an existing cluster's upgrade targets, scoped to its accelerator when known. */
export function clusterVersionQuery(cluster: Cluster): ClusterVersionQuery {
  return {
    workspace: cluster.metadata.workspace,
    imageRegistry: cluster.spec.image_registry,
    type: cluster.spec.type,
    acceleratorType: cluster.status?.accelerator_type,
  };
}

/** The version an upgrading cluster is moving to. */
export function upgradeTargetVersion(cluster: Cluster): string | undefined {
  return cluster.status?.phase === "Upgrading"
    ? cluster.spec.version || undefined
    : undefined;
}

/** The newer-version tip looks for targets on a running cluster only. */
export const isUpgradeable = (cluster: Cluster) =>
  cluster.status?.phase === "Running";

/** The versions this cluster can upgrade to, oldest first. */
export const upgradeVersionsFor = (
  cluster: Cluster,
  candidates: readonly string[],
) => getUpgradeVersions(candidates, cluster.spec.version);

/** A running cluster has a version above `spec.version` to move to. */
export function hasUpgradeVersion(
  cluster: Cluster,
  candidates: readonly string[],
): boolean {
  return (
    isUpgradeable(cluster) && upgradeVersionsFor(cluster, candidates).length > 0
  );
}
