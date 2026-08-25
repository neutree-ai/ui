import { useInvalidate } from "@refinedev/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { registryModelDetailKey } from "@/foundation/hooks/use-registry-model-version";
import {
  deleteRegistryModel,
  type PatchRegistryModelBody,
  patchRegistryModel,
  type RegistryModelError,
  type RegistryModelRef,
} from "@/foundation/lib/api/registry-models";
import type { RegistryModelVersion } from "@/foundation/types/model-types";

/**
 * Writing the parts of one model version a user owns. Everything here is scoped
 * to a single `name:version` and goes to `.../models/:model?version=`.
 *
 * The *read* half is `useRegistryModelVersion` in `@/foundation/hooks`, next to
 * the listing hook: the endpoint form needs it too, and one L2 domain may not
 * import another. Only this domain writes, so the mutations stay here.
 */

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
    queryClient.invalidateQueries({ queryKey: registryModelDetailKey(ref) });
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
