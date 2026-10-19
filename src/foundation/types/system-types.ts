export interface SystemInfo {
  capabilities?: { cluster_cache_providers?: string[] };
  grafana_url?: string;
  version: string;
}
