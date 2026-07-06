import { act, renderHook } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";
import { useRefineFieldArray } from "./use-refine-field-array";

type FormValues = {
  spec: { items: { name: string }[] };
};

function renderFieldArray(
  initialQueryData?: Record<string, unknown> | undefined,
) {
  return renderHook(
    ({ queryData }: { queryData?: Record<string, unknown> }) => {
      const form = useForm<FormValues>({
        defaultValues: { spec: { items: [] } },
      });
      const fieldArray = useRefineFieldArray({
        control: form.control,
        name: "spec.items",
        refineForm: {
          refineCore: { query: { data: { data: queryData } } },
        },
      });
      return { form, fieldArray };
    },
    { initialProps: { queryData: initialQueryData } },
  );
}

describe("useRefineFieldArray", () => {
  it("populates the array from the first query data", () => {
    const { result, rerender } = renderFieldArray(undefined);
    expect(result.current.form.getValues("spec.items")).toEqual([]);

    rerender({ queryData: { spec: { items: [{ name: "a" }] } } });

    expect(result.current.form.getValues("spec.items")).toEqual([
      { name: "a" },
    ]);
  });

  it("does not clobber user edits when query data refreshes", () => {
    const { result, rerender } = renderFieldArray({
      spec: { items: [{ name: "a" }] },
    });
    expect(result.current.form.getValues("spec.items")).toEqual([
      { name: "a" },
    ]);

    // user edits the array
    act(() => {
      result.current.form.setValue("spec.items.0", { name: "edited" });
    });

    // background refetch returns the server state with a new identity
    rerender({ queryData: { spec: { items: [{ name: "a" }] } } });

    expect(result.current.form.getValues("spec.items")).toEqual([
      { name: "edited" },
    ]);
  });

  it("ignores query data without the array path", () => {
    const { result } = renderFieldArray({ spec: {} });
    expect(result.current.form.getValues("spec.items")).toEqual([]);
  });
});
