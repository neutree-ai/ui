import { fireEvent, render, screen } from "@testing-library/react";
import { type FieldValues, FormProvider, useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";
import { isHidden } from "@/foundation/testing/interactions";
import { ModelOptionalFields } from "./ModelOptionalFields";

function Harness({
  version = "",
  file = "",
  errorPath,
}: {
  version?: string;
  file?: string;
  errorPath?: string;
}) {
  const form = useForm<FieldValues>({
    defaultValues: {
      spec: {
        model: { version, file },
      },
    },
  });

  return (
    <FormProvider {...form}>
      {errorPath && (
        <button
          type="button"
          onClick={() =>
            form.setError(errorPath as never, {
              type: "required",
              message: "Required",
            })
          }
        >
          invalidate optional field
        </button>
      )}
      <ModelOptionalFields control={form.control} values={{ version, file }} />
    </FormProvider>
  );
}

describe("ModelOptionalFields", () => {
  it("keeps empty version and file fields collapsed behind a plain action", () => {
    render(<Harness />);

    expect(isHidden(screen.getByTestId("field-spec.model.version"))).toBe(true);
    const toggle = screen.getByTestId("model-optional-fields-toggle");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(toggle);
    screen.getByTestId("field-spec.model.version");
    screen.getByTestId("field-spec.model.file");
    expect(toggle.getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(toggle);
    expect(isHidden(screen.getByTestId("field-spec.model.version"))).toBe(true);
  });

  it("opens automatically when the current model already specifies one", () => {
    render(<Harness version="1.5" />);

    expect(
      screen
        .getByTestId("model-optional-fields-toggle")
        .getAttribute("aria-expanded"),
    ).toBe("true");
    screen.getByTestId("field-spec.model.version");
  });

  it("opens when a collapsed optional field reports an error", async () => {
    render(<Harness errorPath="spec.model.version" />);

    expect(isHidden(screen.getByTestId("field-spec.model.version"))).toBe(true);
    fireEvent.click(
      screen.getByRole("button", { name: "invalidate optional field" }),
    );

    expect(
      isHidden(await screen.findByTestId("field-spec.model.version")),
    ).toBe(false);
    await screen.findByText("Required");
    expect(
      screen
        .getByTestId("model-optional-fields-toggle")
        .getAttribute("aria-expanded"),
    ).toBe("true");
  });
});
