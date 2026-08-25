import { useCustom } from "@refinedev/core";
import { useCallback } from "react";
import type { ApiKeyProject } from "@/domains/api-key/types";

// The caller's Projects in one workspace. This runs as a query rather than a
// mutation so the three places that mount a ProjectPicker (create form, move
// dialog, detail page) share one cached result instead of each firing the RPC
// on mount.
export function useApiKeyProjects(workspace?: string) {
  const { data, isLoading, error, refetch } = useCustom<ApiKeyProject[]>({
    url: "/rpc/list_api_key_projects",
    method: "post",
    config: { payload: { p_workspace: workspace } },
    queryOptions: { enabled: Boolean(workspace) },
    successNotification: false,
    errorNotification: false,
  });

  const reload = useCallback(async () => {
    const next = await refetch();
    return next.data?.data ?? [];
  }, [refetch]);

  return {
    data: data?.data ?? [],
    isLoading: Boolean(workspace) && isLoading,
    error: error ? error.message : "",
    refetch: reload,
  };
}
