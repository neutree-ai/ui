import { useQuery } from "@tanstack/react-query";
import {
  fetchRegistryModel,
  type RegistryModelError,
  type RegistryModelRef,
} from "@/foundation/lib/api/registry-models";
import type { RegistryModelVersion } from "@/foundation/types/model-types";

/**
 * Reads one model version, including what the checkpoint states about itself.
 * This is the expensive read — the listing deliberately does not carry `info`.
 *
 * It sits in foundation, next to `useRegistryModels`, because both the model
 * registry's own pages and the endpoint form need it and one L2 domain may not
 * import another. The *writes* to a version stay in `domains/model-registry`,
 * which is the only place that performs them.
 */

/** The query key one version's detail is cached under. Exported because the
 * domain's writes invalidate it. */
export const registryModelDetailKey = (ref: Partial<RegistryModelRef>) => [
  "registry-model",
  ref.workspace ?? null,
  ref.registry ?? null,
  ref.model ?? null,
  ref.version ?? null,
];

/** A fetched version together with the model it was fetched for. */
type IdentifiedModel = {
  key: string;
  model: RegistryModelVersion;
};

/** A stable identity for a ref, used to check that a fetched result still
 * belongs to the model being asked about. */
const refIdentity = (ref: Partial<RegistryModelRef>) =>
  JSON.stringify(registryModelDetailKey(ref));

/**
 * The result carries the model it belongs to and is discarded when that stops
 * matching what the caller is asking about: showing the previous model's
 * parameter count under the next model's name is worse than showing nothing.
 */
export const useRegistryModelVersion = (ref: Partial<RegistryModelRef>) => {
  const enabled = Boolean(ref.workspace && ref.registry && ref.model);
  const identity = refIdentity(ref);

  const query = useQuery<IdentifiedModel, RegistryModelError>({
    queryKey: registryModelDetailKey(ref),
    queryFn: async ({ signal }) => ({
      key: identity,
      model: await fetchRegistryModel(ref as RegistryModelRef, signal),
    }),
    enabled,
    // The failures this route reports — an unreadable checkpoint, a model that
    // is not there — are answers, not flakes. One retry absorbs a transient
    // gateway blip; three plus backoff would leave a spinner on screen for the
    // better part of a minute before saying what went wrong.
    retry: 1,
  });

  const current = query.data?.key === identity ? query.data.model : null;

  return {
    model: current,
    // A result that belongs to another model is not an answer to this one.
    isLoading: enabled && (query.isLoading || (!current && !query.error)),
    isFetching: query.isFetching,
    error: query.error ?? null,
    refetch: query.refetch,
  };
};
