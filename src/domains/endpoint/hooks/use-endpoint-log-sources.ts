import type { Endpoint } from "@/domains/endpoint/types";
import { useCustom } from "@refinedev/core";

/**
 * Interface for log source item
 */
interface LogSource {
  type: string; // "logs", "application", "stderr", "stdout"
  url: string;
  download_url: string;
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

  const {
    data: logSourcesData,
    isLoading,
    refetch,
  } = useCustom<LogSourcesResponse>({
    url: workspace && name ? `/endpoints/${workspace}/${name}/log-sources` : "",
    method: "get",
    queryOptions: {
      enabled: !!workspace && !!name,
      staleTime: 30 * 1000, // Cache for 30 seconds
    },
  });

  const deployments = logSourcesData?.data?.deployments || [];

  return {
    deployments,
    isLoading,
    refetch,
  };
};
