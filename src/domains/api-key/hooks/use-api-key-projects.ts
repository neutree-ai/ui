import { useCustomMutation } from "@refinedev/core";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ApiKeyProject } from "@/domains/api-key/types";

export function useApiKeyProjects(workspace?: string) {
  const { mutateAsync } = useCustomMutation();
  const [data, setData] = useState<ApiKeyProject[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const request = useRef(0);

  const refetch = useCallback(async () => {
    const current = ++request.current;
    if (!workspace) {
      setData([]);
      setError("");
      setIsLoading(false);
      return [];
    }

    setIsLoading(true);
    setError("");
    try {
      const response = await mutateAsync({
        url: "/rpc/list_api_key_projects",
        method: "post",
        values: { p_workspace: workspace },
      });
      const projects = (response.data as ApiKeyProject[] | null) ?? [];
      if (current === request.current) setData(projects);
      return projects;
    } catch (cause) {
      if (current === request.current) {
        setData([]);
        setError(cause instanceof Error ? cause.message : String(cause));
      }
      return [];
    } finally {
      if (current === request.current) setIsLoading(false);
    }
  }, [mutateAsync, workspace]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { data, isLoading, error, refetch };
}
