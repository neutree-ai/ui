import { useInvalidate } from "@refinedev/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type ModelRegistryConnectionCheck,
  retryModelRegistryConnection,
} from "@/foundation/lib/api/model-registries";
import type { RegistryModelError } from "@/foundation/lib/api/registry-models";

type RetryTarget = {
  workspace: string;
  registry: string;
};

/**
 * Runs a connection check against a registry and takes down everything the
 * check invalidates.
 *
 * The listing is the part that matters. The server drops its cached query
 * results for this registry as part of the check, so whatever it would have
 * replayed is gone; a client that refetched only the status would show a green
 * registry above a stale — possibly empty — model list, and the user would read
 * that as the retry having failed. Both are invalidated together for that
 * reason, and only on success: a check that could not be run has invalidated
 * nothing.
 */
export const useRetryRegistryConnection = () => {
  const queryClient = useQueryClient();
  // Refine owns the key shape for its own resources; let it do that half.
  const invalidate = useInvalidate();

  return useMutation<
    ModelRegistryConnectionCheck,
    RegistryModelError,
    RetryTarget
  >({
    mutationFn: ({ workspace, registry }) =>
      retryModelRegistryConnection(workspace, registry),
    onSuccess: (_data, { workspace, registry }) => {
      queryClient.invalidateQueries({
        queryKey: ["registry-models", workspace, registry],
      });
      invalidate({
        resource: "model_registries",
        invalidates: ["list", "detail"],
        id: registry,
      });
    },
  });
};
