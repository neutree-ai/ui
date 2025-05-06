import { PostgrestClient } from "@supabase/postgrest-js";
import type { Database } from "@aippp/shared/src/types/api-gen";
import type { Cluster } from "@/types";

export const REST_URL = `${location.protocol}//${location.host}/api/v1`;

export const clientPostgrest = new PostgrestClient<Database, "api">(REST_URL, {
  schema: "api",
  headers: {},
});

export const getRayDashboardProxy = (cluster?: unknown) => {
  if (!(cluster as Cluster)?.status?.dashboard_url) {
    return null;
  }

  return `${REST_URL}/ray-dashboard-proxy/${
    (cluster as Cluster).metadata.name
  }/`;
};
