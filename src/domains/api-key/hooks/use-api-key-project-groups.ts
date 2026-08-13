import { useCustomMutation } from "@refinedev/core";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ApiKey, ApiKeyProject } from "@/domains/api-key/types";

type ApiKeyProjectGroup = {
  project: ApiKeyProject;
  api_keys: ApiKey[];
  api_key_count: number;
  current_usage: number;
  total_projects: number;
};

export function useApiKeyProjectGroups(params: {
  workspace?: string;
  search: string;
  projectEnabled: boolean | null;
  apiKeyDisabled: boolean | null;
  page: number;
  pageSize: number;
}) {
  const { mutateAsync } = useCustomMutation();
  const [data, setData] = useState<ApiKeyProjectGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const request = useRef(0);

  const fetchGroups = useCallback(async () => {
    const current = ++request.current;
    setIsLoading(true);
    setError("");
    try {
      const response = await mutateAsync({
        url: "/rpc/get_api_key_project_groups",
        method: "post",
        values: {
          p_workspace: params.workspace ?? null,
          p_search: params.search.trim() || null,
          p_project_enabled: params.projectEnabled,
          p_api_key_disabled: params.apiKeyDisabled,
          p_page: params.page,
          p_page_size: params.pageSize,
        },
      });
      if (current === request.current)
        setData((response.data as ApiKeyProjectGroup[]) ?? []);
    } catch (cause) {
      if (current === request.current) {
        setData([]);
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    } finally {
      if (current === request.current) setIsLoading(false);
    }
  }, [
    mutateAsync,
    params.workspace,
    params.search,
    params.projectEnabled,
    params.apiKeyDisabled,
    params.page,
    params.pageSize,
  ]);

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchGroups(), 300);
    return () => window.clearTimeout(timer);
  }, [fetchGroups]);

  return { data, isLoading, error, refetch: fetchGroups };
}
