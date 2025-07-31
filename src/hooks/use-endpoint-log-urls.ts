import type { Endpoint } from "@/types/endpoint-types";
import { useCustom } from "@refinedev/core";
import { useMemo } from "react";

/**
 * Interface for Ray application information
 */
export interface RayApplicationInfo {
  applications: Record<
    string,
    {
      name: string;
      deployments: Record<
        string,
        {
          replicas: Array<{
            node_id: string;
            actor_id: string;
            log_file_path: string;
            replica_id: string;
          }>;
        }
      >;
    }
  >;
}

/**
 * Interface for log URL definition
 */
export interface LogUrl {
  type: "application" | "error" | "stdout";
  url: string;
  downloadUrl: string;
  deployment: string;
  replica_id: string;
}

/**
 * Interface for hook options
 */
export interface UseEndpointLogUrlsOptions {
  lines?: number;
  downloadLines?: number;
  format?: string;
  downloadFormat?: string;
}

/**
 * Custom hook for generating endpoint log URLs
 *
 * @param endpoint - Endpoint object
 * @param options - Optional configuration
 * @returns Object containing various log URLs, download URLs, and loading states
 *
 * @example
 * ```tsx
 * const { logUrls, logUrlsByType, logUrlsByDeployment, hasLogs, isLoading, refetch } = useEndpointLogUrls(
 *   endpoint,
 *   {
 *     lines: 10000,
 *     downloadLines: -1,
 *     format: "leading_1",
 *     downloadFormat: "text"
 *   }
 * );
 *
 * // Get all application log URLs
 * const appLogUrls = logUrlsByType.application;
 *
 * // Get download URL for the first application log
 * const downloadUrl = appLogUrls[0]?.downloadUrl;
 *
 * // Get all log URLs for Backend deployment
 * const backendLogs = logUrlsByDeployment.Backend;
 * ```
 */

export const useEndpointLogUrls = (
  endpoint: Endpoint | null,
  options: UseEndpointLogUrlsOptions = {},
) => {
  const {
    lines = 50000,
    downloadLines = -1,
    format = "text",
    downloadFormat = "text",
  } = options;

  // Fetch Ray application info
  const {
    data: rayApplicationData,
    isLoading,
    refetch,
  } = useCustom<RayApplicationInfo>({
    url: endpoint
      ? `/ray-dashboard-proxy/${endpoint.spec.cluster}/api/serve/applications/`
      : "",
    method: "get",
    queryOptions: {
      enabled: !!endpoint,
      staleTime: 30 * 1000,
    },
  });

  const rayApplicationInfo = rayApplicationData?.data;

  const logUrls = useMemo((): LogUrl[] => {
    if (!endpoint || !rayApplicationInfo) {
      return [];
    }

    // Helper function to build log URLs with common parameters
    const buildLogUrl = (
      baseUrl: string,
      params: Record<string, string | number>,
      isDownload = false,
    ) => {
      const urlParams = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        urlParams.append(key, String(value));
      }
      urlParams.append("lines", String(isDownload ? downloadLines : lines));
      urlParams.append("format", isDownload ? downloadFormat : format);
      return `${baseUrl}?${urlParams.toString()}`;
    };

    const clusterName = endpoint.spec.cluster;
    const endpointName = endpoint.metadata.name;

    // Find the corresponding application
    const application = rayApplicationInfo.applications[endpointName];
    if (!application) {
      return [];
    }

    const urls: LogUrl[] = [];
    const viewBaseUrl = `/ray-dashboard-proxy/${clusterName}/api/v0/logs/file`;
    const downloadBaseUrl = `/api/v1/ray-dashboard-proxy/${clusterName}/api/v0/logs/file`;

    // Iterate through all deployments and replicas
    for (const [deploymentName, deployment] of Object.entries(
      application.deployments,
    )) {
      for (const replica of deployment.replicas) {
        const { node_id, actor_id, log_file_path, replica_id } = replica;

        if (!log_file_path) {
          continue;
        }

        // Ensure log_file_path doesn't start with '/' (Ray expects relative path)
        const normalizedLogFilePath = log_file_path.startsWith("/")
          ? log_file_path.slice(1)
          : log_file_path;

        // Application logs (via node_id + filename)
        const applicationLogUrl = buildLogUrl(viewBaseUrl, {
          node_id,
          filename: normalizedLogFilePath,
        });
        const applicationDownloadUrl = buildLogUrl(
          downloadBaseUrl,
          {
            node_id,
            filename: normalizedLogFilePath,
          },
          true,
        );

        urls.push({
          type: "application",
          url: applicationLogUrl,
          downloadUrl: applicationDownloadUrl,
          deployment: deploymentName,
          replica_id,
        });

        // Error logs (via actor_id + err)
        const errorLogUrl = buildLogUrl(viewBaseUrl, {
          actor_id,
          suffix: "err",
        });
        const errorDownloadUrl = buildLogUrl(
          downloadBaseUrl,
          {
            actor_id,
            suffix: "err",
          },
          true,
        );

        urls.push({
          type: "error",
          url: errorLogUrl,
          downloadUrl: errorDownloadUrl,
          deployment: deploymentName,
          replica_id,
        });

        // Stdout logs (via actor_id + stdout)
        const stdoutLogUrl = buildLogUrl(viewBaseUrl, {
          actor_id,
          suffix: "out",
        });
        const stdoutDownloadUrl = buildLogUrl(
          downloadBaseUrl,
          {
            actor_id,
            suffix: "out",
          },
          true,
        );

        urls.push({
          type: "stdout",
          url: stdoutLogUrl,
          downloadUrl: stdoutDownloadUrl,
          deployment: deploymentName,
          replica_id,
        });
      }
    }

    return urls;
  }, [
    endpoint,
    rayApplicationInfo,
    lines,
    format,
    downloadLines,
    downloadFormat,
  ]);

  // Group URLs by type
  const logUrlsByType = useMemo(() => {
    return {
      application: logUrls.filter((log) => log.type === "application"),
      error: logUrls.filter((log) => log.type === "error"),
      stdout: logUrls.filter((log) => log.type === "stdout"),
    };
  }, [logUrls]);

  // Group URLs by deployment
  const logUrlsByDeployment = useMemo(() => {
    const grouped: Record<string, LogUrl[]> = {};
    for (const log of logUrls) {
      if (!grouped[log.deployment]) {
        grouped[log.deployment] = [];
      }
      grouped[log.deployment].push(log);
    }
    return grouped;
  }, [logUrls]);

  return {
    logUrls,
    logUrlsByType,
    logUrlsByDeployment,
    hasLogs: logUrls.length > 0,
    isLoading,
    refetch,
    rayApplicationInfo,
  };
};
