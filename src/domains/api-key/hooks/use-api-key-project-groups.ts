import { useCustom } from "@refinedev/core";
import { useCallback } from "react";
import type { ApiKey, ApiKeyProject } from "@/domains/api-key/types";

type ApiKeyProjectGroup = {
  project: ApiKeyProject;
  api_keys: ApiKey[];
  api_key_count: number;
  current_usage: number;
  total_projects: number;
};

type GroupParams = {
  workspace?: string;
  search: string;
  apiKeyDisabled: boolean | null;
  page: number;
  pageSize: number;
};

// The grouped listing and its total key count share the same filters, so they
// are issued as two queries keyed on those filters. Running them through
// react-query (rather than a mutation plus a hand-rolled race guard) means a
// superseded filter combination can no longer overwrite the current one.
export function useApiKeyProjectGroups(params: GroupParams) {
  const filters = {
    p_workspace: params.workspace ?? null,
    p_search: params.search.trim() || null,
    p_api_key_disabled: params.apiKeyDisabled,
  };

  const groups = useCustom<ApiKeyProjectGroup[]>({
    url: "/rpc/get_api_key_project_groups",
    method: "post",
    config: {
      payload: {
        ...filters,
        p_page: params.page,
        p_page_size: params.pageSize,
      },
    },
    successNotification: false,
    errorNotification: false,
  });

  const total = useCustom<{ count: number }>({
    url: "/rpc/count_api_key_project_group_api_keys",
    method: "post",
    config: { payload: filters },
    successNotification: false,
    errorNotification: false,
  });

  const refetch = useCallback(async () => {
    await Promise.all([groups.refetch(), total.refetch()]);
  }, [groups.refetch, total.refetch]);

  const failure = groups.error ?? total.error;

  return {
    data: failure ? [] : (groups.data?.data ?? []),
    totalApiKeys: failure ? 0 : Number(total.data?.data) || 0,
    isLoading: groups.isLoading || total.isLoading,
    error: failure ? failure.message : "",
    refetch,
  };
}
