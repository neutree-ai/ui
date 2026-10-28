import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { type FieldValues, useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import { Form } from "@/components/ui/form";
import { FormCombobox } from "./FormCombobox";
import { FormFieldGroup } from "./FormFieldGroup";

const OPTIONS = [
  { label: "Text Generation", value: "text-generation" },
  { label: "Text Embedding", value: "text-embedding" },
];

// Render through FormFieldGroup so the combobox receives field.value the same
// way production forms inject it (cloneElement spreads the controller field).
// Only string props are expressible in JSX — null and BaseRecord values reach
// the component exclusively through this injection, and the API returns
// explicit nulls for empty composite-type fields.
function Harness({
  fieldValue,
  required = false,
  renderOption,
  allowCustomValue,
}: {
  fieldValue: unknown;
  required?: boolean;
  renderOption?: (option: (typeof OPTIONS)[number]) => React.ReactNode;
  allowCustomValue?: boolean;
}) {
  const form = useForm<FieldValues>({ defaultValues: { task: fieldValue } });
  return (
    <Form {...form}>
      <FormFieldGroup {...form} name="task" label="Task" required={required}>
        <FormCombobox
          options={OPTIONS}
          placeholder="Select task"
          renderOption={renderOption}
          allowCustomValue={allowCustomValue}
        />
      </FormFieldGroup>
    </Form>
  );
}

const getTrigger = () => screen.getByRole("combobox");

describe("FormCombobox", () => {
  it.each([
    { fieldValue: null, shown: "Select task" },
    { fieldValue: undefined, shown: "Select task" },
    { fieldValue: "text-embedding", shown: "Text Embedding" },
    { fieldValue: { id: "text-generation" }, shown: "Text Generation" },
  ])("shows $shown on the trigger for $fieldValue", ({ fieldValue, shown }) => {
    render(<Harness fieldValue={fieldValue} />);
    expect(getTrigger().textContent).toContain(shown);
  });

  it("renders no option label for an object field value without an id", () => {
    render(<Harness fieldValue={{ name: "x" }} />);
    const text = getTrigger().textContent ?? "";
    expect(text).not.toContain("Text Generation");
    expect(text).not.toContain("Text Embedding");
  });

  it("renders a required marker for required fields", () => {
    render(<Harness fieldValue={undefined} required />);
    expect(screen.getByText("*").getAttribute("aria-hidden")).toBe("true");
  });

  it("uses custom option content without reserving check-icon space", () => {
    render(
      <Harness
        fieldValue={undefined}
        renderOption={(option) => <span>{option.label} status</span>}
      />,
    );

    fireEvent.click(getTrigger());

    screen.getByText("Text Generation status");
  });

  it.each([
    { renderer: "default", renderOption: undefined },
    {
      renderer: "custom",
      renderOption: (option: { label: string }) => <span>{option.label}</span>,
    },
  ])(
    "marks the stored value as checked with the $renderer renderer",
    ({ renderOption }) => {
      render(
        <Harness fieldValue="text-generation" renderOption={renderOption} />,
      );
      fireEvent.click(getTrigger());

      const checked = screen.getAllByRole("option", { checked: true });
      expect(checked.map((o) => o.textContent)).toEqual(["Text Generation"]);
    },
  );
});

describe("FormCombobox with allowCustomValue", () => {
  // cmdk marks its input with this attribute.
  const searchBox = () =>
    document.querySelector("[cmdk-input]") as HTMLInputElement;

  it("offers the typed text as a value of its own", () => {
    render(<Harness fieldValue="" allowCustomValue />);
    fireEvent.click(getTrigger());
    fireEvent.change(searchBox(), { target: { value: "acme-research-lab" } });
    screen.getByText(/acme-research-lab/);
  });

  it("does not offer text that already matches an option value", () => {
    // Otherwise the list would show the option and a duplicate "use this"
    // row for the same value.
    render(<Harness fieldValue="" allowCustomValue />);
    fireEvent.click(getTrigger());
    fireEvent.change(searchBox(), { target: { value: "text-generation" } });
    // Only the real option row is present; no "use this" duplicate beside it.
    expect(screen.getAllByText(/Text Generation/)).toHaveLength(1);
  });

  it("shows a stored custom value on the trigger instead of the placeholder", () => {
    // A value with no matching option would otherwise read as "nothing
    // selected", which is how a saved custom source would appear on reopen.
    render(<Harness fieldValue="acme-research-lab" allowCustomValue />);
    expect(getTrigger().textContent).toContain("acme-research-lab");
  });

  it("leaves the trigger blank for an unlisted value when custom values are off", () => {
    // Pre-existing behaviour, unchanged: with no matching option there is no
    // label to show, and the placeholder is only used for an empty value. The
    // allowCustomValue fallback above is what stops a saved custom source from
    // reading this way.
    render(<Harness fieldValue="acme-research-lab" />);
    expect(getTrigger().textContent).toBe("");
  });
});

describe("FormCombobox clearing", () => {
  const searchBox = () =>
    document.querySelector("[cmdk-input]") as HTMLInputElement;

  // ComboboxProps intersects its own onChange with Command's DOM handler, so
  // the prop is taken as-is and handed straight through.
  function ClearHarness({
    onChange,
  }: {
    onChange: ComponentProps<typeof FormCombobox>["onChange"];
  }) {
    const form = useForm<FieldValues>({
      defaultValues: { task: "text-generation" },
    });
    return (
      <Form {...form}>
        <FormFieldGroup {...form} name="task" label="Task">
          <FormCombobox
            options={OPTIONS}
            placeholder="Select task"
            onChange={onChange}
          />
        </FormFieldGroup>
      </Form>
    );
  }

  it("offers an explicit way to clear a set value", () => {
    // The empty state is meaningful for optional fields, and a toggle the user
    // has to guess at is one they ask about rather than find.
    const onChange = vi.fn();
    render(<ClearHarness onChange={onChange} />);
    fireEvent.click(getTrigger());
    fireEvent.click(screen.getByText("components.ui.combobox.clearSelection"));
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("does not offer it when nothing is selected", () => {
    render(<Harness fieldValue="" />);
    fireEvent.click(getTrigger());
    expect(screen.queryByText("Clear selection")).toBeNull();
  });

  it("clears when the selected option is picked again", () => {
    const onChange = vi.fn();
    render(<ClearHarness onChange={onChange} />);
    fireEvent.click(getTrigger());
    fireEvent.change(searchBox(), { target: { value: "Text Generation" } });
    // The trigger also reads "Text Generation"; the row is the one in the list.
    fireEvent.click(
      document.querySelectorAll("[cmdk-item]")[
        document.querySelectorAll("[cmdk-item]").length - 1
      ] as HTMLElement,
    );
    expect(onChange).toHaveBeenCalledWith("");
  });
});
