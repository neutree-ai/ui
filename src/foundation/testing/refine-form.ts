import type { FieldValues, UseFormProps } from "react-hook-form";
import { useForm as useRhfForm } from "react-hook-form";
import { vi } from "vitest";

/**
 * State behind the global `@refinedev/react-hook-form` mock. Tests set
 * `queryData` to simulate the record an edit form loads, read `options` to
 * inspect what the hook passed to Refine, and assert on `onFinish`. Reset
 * before every test by the setup file.
 */
export const refineForm = {
  onFinish: vi.fn(),
  queryData: undefined as unknown,
  options: undefined as Record<string, unknown> | undefined,
};

export function resetRefineForm() {
  refineForm.onFinish.mockReset();
  refineForm.queryData = undefined;
  refineForm.options = undefined;
}

// Bridges Refine's useForm to plain react-hook-form. Like the real one, it
// returns a new object on every render.
export function useForm(options: Record<string, unknown> = {}) {
  refineForm.options = options;
  const { refineCoreProps, warnWhenUnsavedChanges, ...rhfOptions } = options;
  const form = useRhfForm(rhfOptions as UseFormProps<FieldValues>);
  return {
    ...form,
    refineCore: {
      onFinish: refineForm.onFinish,
      query:
        refineForm.queryData === undefined
          ? undefined
          : { data: { data: refineForm.queryData } },
    },
  };
}
