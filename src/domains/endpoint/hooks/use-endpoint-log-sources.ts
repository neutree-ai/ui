import { useCustom } from "@refinedev/core";
import type { Endpoint } from "@/domains/endpoint/types";

/**
 * Interface for log source item
 */
export interface LogSource {
  type: string; // "logs", "application", "stderr", "stdout"
  url: string;
  download_url: string;
  container_name?: string;
  restart_count?: number;
  started?: boolean;
}

/**
 * Interface for replica with logs
 */
interface Replica {
  replica_id: string;
  logs: LogSource[];
}

/**
 * Interface for deployment with replicas
 */
interface Deployment {
  name: string;
  replicas: Replica[];
}

/**
 * Find the Backend deployment's replicas (or the first deployment's replicas as fallback)
 */
export const getBackendReplicas = (deployments: Deployment[]): Replica[] => {
  const backend =
    deployments.find((deployment) => deployment.name === "Backend") ||
    deployments[0];
  return backend?.replicas ?? [];
};

/**
 * Interface for log sources response
 */
interface LogSourcesResponse {
  deployments: Deployment[];
}

/**
 * Custom hook for fetching endpoint log sources using the new unified API
 *
 * This hook fetches log sources from the new endpoint logs API which supports
 * both Ray and Kubernetes clusters in a unified way.
 *
 * @param endpoint - Endpoint object
 * @returns Object containing deployments, loading states, and refetch function
 *
 * @example
 * ```tsx
 * const { deployments, isLoading, refetch } = useEndpointLogSources(endpoint);
 *
 * // Access deployments
 * deployments.forEach(deployment => {
 *   console.log(`Deployment: ${deployment.name}`);
 *   deployment.replicas.forEach(replica => {
 *     console.log(`  Replica: ${replica.replica_id}`);
 *     replica.logs.forEach(log => {
 *       console.log(`    Log type: ${log.type}, URL: ${log.url}`);
 *     });
 *   });
 * });
 * ```
 */
export const useEndpointLogSources = (endpoint: Endpoint | null) => {
  const workspace = endpoint?.metadata.workspace;
  const name = endpoint?.metadata.name;
  const enabled = !!workspace && !!name;

  const {
    data: logSourcesData,
    isLoading,
    refetch,
  } = useCustom<LogSourcesResponse>({
    url: workspace && name ? `/endpoints/${workspace}/${name}/log-sources` : "",
    method: "get",
    queryOptions: {
      enabled,
      staleTime: 30 * 1000, // Cache for 30 seconds
    },
  });

  const deployments = enabled ? logSourcesData?.data?.deployments || [] : [];

  return {
    deployments,
    isLoading: enabled && isLoading,
    refetch,
  };
};
