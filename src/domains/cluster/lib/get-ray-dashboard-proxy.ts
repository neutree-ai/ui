import type { Cluster } from "@/domains/cluster/types";
import { REST_URL } from "@/foundation/lib/api";

export const getRayDashboardProxy = (cluster?: unknown) => {
  if (!(cluster as Cluster)?.status?.dashboard_url) {
    return null;
  }

  const { metadata } = cluster as Cluster;

  return `${REST_URL}/ray-dashboard-proxy/${metadata.workspace}/${
    metadata.name
  }/`;
};
