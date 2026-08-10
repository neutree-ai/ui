import { useInvalidate } from "@refinedev/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteRegistryModel,
  fetchRegistryModel,
  type PatchRegistryModelBody,
  patchRegistryModel,
  type RegistryModelError,
  type RegistryModelRef,
} from "@/foundation/lib/api/registry-models";
import type { RegistryModelVersion } from "@/foundation/types/model-types";

/**
 * One model version: reading its detail and writing the parts of it a user
 * owns. Everything here is scoped to a single `name:version` and goes to
 * `.../models/:model?version=`.
 *
 * Its counterpart is `useRegistryModels` in `@/foundation/hooks` — the *listing*
 * of a registry's models, read-only, paged. That one lives in foundation rather
 * than beside this file because `domains/endpoint` consumes it too and
 * `.dependency-cruiser.cjs` forbids one L2 domain importing another. Nothing
 * outside this domain reads a single version, so this half stays here.
 */

const detailKey = (ref: Partial<RegistryModelRef>) => [
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
  JSON.stringify(detailKey(ref));

/**
 * Reads one model version, including what the checkpoint states about itself.
 * This is the expensive read — the listing deliberately does not carry `info`.
 *
 * The result carries the model it belongs to and is discarded when that stops
 * matching what the caller is asking about. This page exists to state facts
 * about one checkpoint, so showing the previous model's parameter count under
 * the next model's name is worse than showing nothing at all.
 */
export const useRegistryModelVersion = (ref: Partial<RegistryModelRef>) => {
  const enabled = Boolean(ref.workspace && ref.registry && ref.model);
  const identity = refIdentity(ref);

  const query = useQuery<IdentifiedModel, RegistryModelError>({
    queryKey: detailKey(ref),
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

/**
 * Invalidates what a write to a model makes stale: the version's own detail, the
 * listing it appears in, and the registry row that carries the counters.
 *
 * The counters will not have moved by the time the row is refetched. The control
 * plane measures a registry out of band and only re-walks it once the figures it
 * holds are older than its stale window, so a read straight after a delete
 * returns whatever was last measured; the new count lands on a later reconcile.
 * Invalidating is still worth doing — it is what makes the page pick those
 * figures up on its own instead of showing the pre-write numbers until something
 * else happens to refetch.
 */
const useInvalidateModel = () => {
  const queryClient = useQueryClient();
  // Refine owns the key shape for its own resources, so let it do that half.
  const invalidate = useInvalidate();

  return (ref: RegistryModelRef) => {
    queryClient.invalidateQueries({ queryKey: detailKey(ref) });
    queryClient.invalidateQueries({
      queryKey: ["registry-models", ref.workspace, ref.registry],
    });
    invalidate({
      resource: "model_registries",
      invalidates: ["list", "detail"],
      id: ref.registry,
    });
  };
};

/**
 * Writes a model's alias and hand-filled metadata.
 *
 * The server states provenance itself: everything sent here is recorded as
 * hand-filled, whatever the body claims.
 */
export const useUpdateRegistryModelVersion = () => {
  const invalidate = useInvalidateModel();

  return useMutation<
    RegistryModelVersion,
    RegistryModelError,
    { ref: RegistryModelRef; body: PatchRegistryModelBody }
  >({
    mutationFn: ({ ref, body }) => patchRegistryModel(ref, body),
    onSuccess: (_data, variables) => invalidate(variables.ref),
  });
};

/**
 * Deletes a model version. A delete the server refuses because something still
 * points at the model comes back as a RegistryModelError whose body names the
 * referring objects.
 */
export const useDeleteRegistryModelVersion = () => {
  const invalidate = useInvalidateModel();

  return useMutation<void, RegistryModelError, RegistryModelRef>({
    mutationFn: (ref) => deleteRegistryModel(ref),
    onSuccess: (_data, ref) => invalidate(ref),
  });
};
