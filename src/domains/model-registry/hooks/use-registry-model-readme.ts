import { useQuery } from "@tanstack/react-query";
import {
  fetchRegistryModelReadme,
  type RegistryModelError,
  type RegistryModelReadme,
  type RegistryModelRef,
} from "@/foundation/lib/api/registry-models";

/**
 * Reads a model's card.
 *
 * Kept out of the model detail query rather than folded into it: a registry that
 * serves no cards, or a model that simply has none, must not stop the rest of
 * the page from rendering, and a card is a separate request to the registry
 * anyway.
 */
export const useRegistryModelReadme = (ref: Partial<RegistryModelRef>) => {
  const enabled = Boolean(ref.workspace && ref.registry && ref.model);

  const query = useQuery<RegistryModelReadme, RegistryModelError>({
    queryKey: [
      "registry-model-readme",
      ref.workspace ?? null,
      ref.registry ?? null,
      ref.model ?? null,
      ref.version ?? null,
    ],
    queryFn: ({ signal }) =>
      fetchRegistryModelReadme(ref as RegistryModelRef, signal),
    enabled,
    // "This registry serves no cards" and "this model has none" are settled
    // answers; asking again cannot change them. Only a server-side failure is
    // worth one more attempt.
    retry: (failureCount, error) => error.status >= 500 && failureCount < 1,
  });

  return {
    readme: query.data ?? null,
    isLoading: enabled && query.isLoading,
    error: query.error ?? null,
  };
};
