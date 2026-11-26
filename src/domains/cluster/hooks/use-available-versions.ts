import { useCustom } from "@refinedev/core";
import {
  availableVersionsUrl,
  type ClusterVersionQuery,
} from "../lib/upgrade-versions";

const NO_VERSIONS: string[] = [];

/** `GET /clusters/available_versions` for a cluster shape; idle until the shape is known. */
export function useAvailableVersions(
  query: ClusterVersionQuery,
  { enabled = true, staleTime }: { enabled?: boolean; staleTime?: number } = {},
) {
  const url = availableVersionsUrl(query);
  const { data, isLoading } = useCustom<{ available_versions: string[] }>({
    url: url ?? "",
    method: "get",
    queryOptions: { enabled: enabled && !!url, staleTime },
  });
  return {
    versions: data?.data?.available_versions ?? NO_VERSIONS,
    isLoading,
    /** Whether the shape is complete enough to ask. */
    queryable: !!url,
  };
}
