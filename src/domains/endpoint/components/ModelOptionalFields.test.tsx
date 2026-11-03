import { fireEvent, render, screen } from "@testing-library/react";
import { type FieldValues, FormProvider, useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import { ModelOptionalFields } from "./ModelOptionalFields";

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function Harness({
  version = "",
  file = "",
}: {
  version?: string;
  file?: string;
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
      <ModelOptionalFields control={form.control} values={{ version, file }} />
    </FormProvider>
  );
}

describe("ModelOptionalFields", () => {
  it("keeps empty version and file fields collapsed behind a plain action", () => {
    render(<Harness />);

    expect(screen.queryByTestId("field-spec.model.version")).toBeNull();
    const toggle = screen.getByTestId("model-optional-fields-toggle");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(toggle);
    screen.getByTestId("field-spec.model.version");
    screen.getByTestId("field-spec.model.file");
    expect(toggle.getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(toggle);
    expect(screen.queryByTestId("field-spec.model.version")).toBeNull();
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
});
