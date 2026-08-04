import { useQuery } from "@tanstack/react-query";
import {
  fetchRegistryModels,
  type RegistryModelError,
  type RegistryModelPage,
} from "@/foundation/lib/api/registry-models";

type UseRegistryModelsParams = {
  workspace?: string | null;
  registry?: string | null;
  search?: string;
  limit?: number;
  offset?: number;
  /** Additional gate on top of "we know which registry to ask". */
  enabled?: boolean;
  staleTime?: number;
  /**
   * Hold the previous page while the next one loads. Wanted when paging through
   * one registry, unwanted when the result is being validated against — the
   * previous registry's models would then answer for the current one.
   */
  keepPreviousData?: boolean;
};

/**
 * Lists the models of one registry.
 *
 * The single place the models listing is fetched from — the endpoint form's
 * model picker and the registry's own model list both come through here, so the
 * URL, the paging parameters and the `Content-Range` total are defined once.
 *
 * `total` is null when the registry cannot count what matched (a public
 * Hugging Face registry never can). Callers must render that as unknown rather
 * than substituting the number of rows they happen to be holding.
 */
export const useRegistryModels = ({
  workspace,
  registry,
  search,
  limit,
  offset,
  enabled = true,
  staleTime,
  keepPreviousData = false,
}: UseRegistryModelsParams) => {
  const canQuery = Boolean(workspace && registry && enabled);

  const query = useQuery<RegistryModelPage, RegistryModelError>({
    queryKey: [
      "registry-models",
      workspace,
      registry,
      search ?? "",
      limit ?? null,
      offset ?? 0,
    ],
    queryFn: ({ signal }) =>
      fetchRegistryModels(
        {
          workspace: workspace as string,
          registry: registry as string,
          search,
          limit,
          offset,
        },
        signal,
      ),
    enabled: canQuery,
    keepPreviousData,
    staleTime,
  });

  return {
    /**
     * The page itself, or null when none has arrived. A caller that has to tell
     * "no models matched" from "no answer yet" must read this rather than the
     * empty array below.
     */
    page: query.data ?? null,
    models: query.data?.models ?? [],
    total: query.data?.total ?? null,
    isLoading: query.isLoading && canQuery,
    isFetching: query.isFetching,
    error: query.error ?? null,
    refetch: query.refetch,
  };
};
