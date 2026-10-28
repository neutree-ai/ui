import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  type FieldValues,
  FormProvider,
  type UseFormReturn,
} from "react-hook-form";

/**
 * Renders the fields a form hook returns inside a FormProvider, the way a
 * page does. `result.current` is the hook's latest return value, so a test
 * can drive the form (`result.current.form.setValue`) or read derived state.
 *
 *   const { result } = renderForm(
 *     () => useUserForm({ action: "create" }),
 *     (r) => r.registerFields,
 *   );
 */
export function renderForm<R extends { form: UseFormReturn<FieldValues> }>(
  useHook: () => R,
  fields: (result: R) => ReactNode,
) {
  const result = { current: undefined as unknown as R };
  function Harness() {
    result.current = useHook();
    return (
      <FormProvider {...result.current.form}>
        <form>{fields(result.current)}</form>
      </FormProvider>
    );
  }
  return { ...render(<Harness />), result };
}
