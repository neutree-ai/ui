import { useQuery } from "@tanstack/react-query";
import {
  fetchImageRepositories,
  type ImageRegistryContentError,
  type ImageRepositoryPage,
} from "@/foundation/lib/api/image-registry-content";

type UseImageRepositoriesParams = {
  workspace?: string | null;
  registry?: string | null;
  namespace?: string;
  /** Already debounced by the caller — this is a query key, so a keystroke in
   * it is a request. */
  search?: string;
  pageSize?: number;
  /** Additional gate on top of "we know which registry to ask". */
  enabled?: boolean;
};

/**
 * Lists the repositories one image registry holds.
 *
 * Not every registry can answer this, which is why the error is carried out
 * rather than swallowed: `error.reason` says whether a namespace still has to
 * be named, whether the credentials fall short, whether this registry can be
 * enumerated at all, or whether it was just a bad moment. Those are four
 * different things to tell someone, and only the last is worth a retry — which
 * is why a stated refusal is not retried here.
 */
export const useImageRepositories = ({
  workspace,
  registry,
  namespace,
  search,
  pageSize,
  enabled = true,
}: UseImageRepositoriesParams) => {
  const canQuery = Boolean(workspace && registry && enabled);

  const query = useQuery<ImageRepositoryPage, ImageRegistryContentError>({
    queryKey: [
      "image-repositories",
      workspace,
      registry,
      namespace ?? "",
      search ?? "",
      pageSize ?? null,
    ],
    queryFn: ({ signal }) =>
      fetchImageRepositories(
        {
          workspace: workspace as string,
          registry: registry as string,
          namespace,
          search,
          pageSize,
        },
        signal,
      ),
    enabled: canQuery,
    // Holding the previous page keeps the list from emptying itself on every
    // keystroke that survives the debounce.
    keepPreviousData: true,
    staleTime: 30_000,
    retry: 1,
  });

  return {
    repositories: query.data?.repositories ?? [],
    total: query.data?.total ?? null,
    hasMore: query.data?.hasMore ?? false,
    isLoading: query.isLoading && canQuery,
    isFetching: query.isFetching && canQuery,
    error: query.error ?? null,
  };
};
