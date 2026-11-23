import { useCustomMutation, useInvalidate } from "@refinedev/core";

type RowWriteMethod = "post" | "patch" | "delete";

type RowWriteOptions = {
  /** Resources whose lists are invalidated after a write. */
  invalidates: readonly string[];
  /**
   * The error to throw when a PATCH or DELETE changed no row: RLS hides the
   * row or someone else removed it. Without it, such a write passes silently.
   */
  onNoRow?: () => Error;
  /** Drop reads already in flight: they started before the write. */
  cancelRefetch?: boolean;
  /** Further invalidation, run alongside the resource lists. */
  invalidateMore?: () => Promise<unknown>;
};

/** A PostgREST row write that returns the written rows. */
export const useRowWrite = ({
  invalidates,
  onNoRow,
  cancelRefetch = false,
  invalidateMore,
}: RowWriteOptions) => {
  const { mutateAsync, isLoading } = useCustomMutation();
  const invalidate = useInvalidate();

  const run = async (
    url: string,
    method: RowWriteMethod,
    values?: unknown,
  ): Promise<unknown[] | null> => {
    const { data } = await mutateAsync({
      url,
      method,
      values: values as Record<string, unknown>,
      meta: { headers: { Prefer: "return=representation" } },
      successNotification: false,
      errorNotification: false,
    });
    if (onNoRow && method !== "post" && Array.isArray(data) && !data.length) {
      throw onNoRow();
    }
    await Promise.all([
      ...invalidates.map((resource) =>
        invalidate({
          resource,
          invalidates: ["list"],
          ...(cancelRefetch
            ? { invalidationOptions: { cancelRefetch: true } }
            : {}),
        }),
      ),
      invalidateMore?.(),
    ]);
    return data as unknown[] | null;
  };

  return { run, isPending: isLoading };
};
