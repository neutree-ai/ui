import type { SystemInfo } from "@/foundation/types/system-types";
import { useCustom } from "@refinedev/core";

export const useSystemApi = () => {
  const { data, isLoading, error, refetch } = useCustom<SystemInfo>({
    url: "/system/info",
    method: "get",
    queryOptions: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 3,
    },
  });

  const systemInfo = data?.data;

  return {
    systemInfo,
    isLoading,
    error,
    refetch,
    grafanaUrl: systemInfo?.grafana_url,
  };
};
