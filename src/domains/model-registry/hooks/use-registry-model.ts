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

const detailKey = (ref: Partial<RegistryModelRef>) => [
  "registry-model",
  ref.workspace ?? null,
  ref.registry ?? null,
  ref.model ?? null,
  ref.version ?? null,
];

/**
 * Reads one model version, including what the checkpoint states about itself.
 * This is the expensive read — the listing deliberately does not carry `info`.
 */
export const useRegistryModel = (ref: Partial<RegistryModelRef>) => {
  const enabled = Boolean(ref.workspace && ref.registry && ref.model);

  const query = useQuery<RegistryModelVersion, RegistryModelError>({
    queryKey: detailKey(ref),
    queryFn: ({ signal }) =>
      fetchRegistryModel(ref as RegistryModelRef, signal),
    enabled,
  });

  return {
    model: query.data ?? null,
    isLoading: query.isLoading && enabled,
    isFetching: query.isFetching,
    error: query.error ?? null,
    refetch: query.refetch,
  };
};

/**
 * Invalidates everything that shows a model: its own detail, the listing it
 * appears in, and the registry row carrying the counters.
 */
const useInvalidateModel = () => {
  const queryClient = useQueryClient();

  return (ref: RegistryModelRef) => {
    queryClient.invalidateQueries({ queryKey: detailKey(ref) });
    queryClient.invalidateQueries({
      queryKey: ["registry-models", ref.workspace, ref.registry],
    });
  };
};

/**
 * Writes a model's alias and hand-filled metadata.
 *
 * The server states provenance itself: everything sent here is recorded as
 * hand-filled, whatever the body claims.
 */
export const useUpdateRegistryModel = () => {
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
export const useDeleteRegistryModel = () => {
  const invalidate = useInvalidateModel();

  return useMutation<void, RegistryModelError, RegistryModelRef>({
    mutationFn: (ref) => deleteRegistryModel(ref),
    onSuccess: (_data, ref) => invalidate(ref),
  });
};
