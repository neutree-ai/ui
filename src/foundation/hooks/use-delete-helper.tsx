import {
  pickNotDeprecated,
  useDelete,
  useMutationMode,
  useResource,
  useResourceParams,
  useWarnAboutChange,
} from "@refinedev/core";
import type { MutateOptions } from "@tanstack/react-query";

type DeleteHelperReturnType = {
  isLoading: boolean;
  mutate: (
    e?: MutateOptions<unknown, unknown, unknown, unknown> & { meta?: any },
  ) => any; // TODO: UseDeleteReturnType fix
};

export const useDeleteHelper = (
  resource: string,
  recordItemId: string,
  meta?: any,
): DeleteHelperReturnType => {
  const id = useResourceParams();

  const { resource: _resource, identifier } = useResource(resource);

  const { mutationMode } = useMutationMode();

  const { mutate, isLoading } = useDelete();

  const { setWarnWhen } = useWarnAboutChange();

  const onDeleteMutate = (
    options?: MutateOptions<unknown, unknown, unknown, unknown> & {
      meta?: any;
    },
  ): any => {
    if ((recordItemId ?? id) && identifier) {
      setWarnWhen(false);
      const mergedMeta = {
        ...pickNotDeprecated(meta),
        ...options?.meta,
      };
      return mutate(
        {
          id: recordItemId ?? id ?? "",
          resource: identifier,
          mutationMode,
          meta: mergedMeta,
          metaData: mergedMeta,
        },
        options,
      );
    }

    return undefined;
  };

  return {
    mutate: onDeleteMutate,
    isLoading,
  };
};
