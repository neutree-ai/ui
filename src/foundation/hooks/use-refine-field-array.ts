import { useEffect } from "react";
import {
  type FieldArray,
  type FieldArrayPath,
  type FieldValues,
  type UseFieldArrayProps,
  type UseFieldArrayReturn,
  // biome-ignore lint/style/noRestrictedImports: this is the wrapper itself
  useFieldArray,
} from "react-hook-form";

/**
 * Drop-in replacement for `useFieldArray` that automatically syncs with
 * Refine's query data in edit mode.
 *
 * Refine's `useForm` populates form values via `setValue()`, but
 * react-hook-form's `useFieldArray` ignores `setValue` on its array path.
 * This hook bridges the gap by calling `replace()` when query data arrives.
 */
export function useRefineFieldArray<
  TFieldValues extends FieldValues = FieldValues,
  TFieldArrayName extends
    FieldArrayPath<TFieldValues> = FieldArrayPath<TFieldValues>,
  TKeyName extends string = "id",
>(
  props: UseFieldArrayProps<TFieldValues, TFieldArrayName, TKeyName> & {
    /** Pass the `form` object returned by Refine's `useForm`. Optional for create-only forms. */
    refineForm?: {
      refineCore: {
        query?: { data?: { data?: Record<string, unknown> } };
      };
    };
  },
): UseFieldArrayReturn<TFieldValues, TFieldArrayName, TKeyName> {
  const { refineForm, ...fieldArrayProps } = props;
  const result = useFieldArray<TFieldValues, TFieldArrayName, TKeyName>(
    fieldArrayProps,
  );

  const queryData = refineForm?.refineCore?.query?.data?.data;

  useEffect(() => {
    if (!queryData) return;
    const arr = fieldArrayProps.name
      .split(".")
      .reduce<unknown>(
        (obj, key) => (obj as Record<string, unknown>)?.[key],
        queryData,
      );
    if (Array.isArray(arr) && arr.length > 0) {
      result.replace(arr as FieldArray<TFieldValues, TFieldArrayName>[]);
    }
  }, [queryData, fieldArrayProps.name, result.replace]);

  return result;
}
