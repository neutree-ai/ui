import { fireEvent, render, screen } from "@testing-library/react";
import { type FieldValues, useForm } from "react-hook-form";
import { beforeAll, describe, expect, it } from "vitest";

import { Form } from "@/components/ui/form";
import { FormCombobox } from "./FormCombobox";
import { FormFieldGroup } from "./FormFieldGroup";

const OPTIONS = [
  { label: "Text Generation", value: "text-generation" },
  { label: "Text Embedding", value: "text-embedding" },
];

beforeAll(() => {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  HTMLElement.prototype.scrollIntoView = () => {};
});

// Render through FormFieldGroup so the combobox receives field.value the same
// way production forms inject it (cloneElement spreads the controller field).
// Only string props are expressible in JSX — null and BaseRecord values reach
// the component exclusively through this injection, and the API returns
// explicit nulls for empty composite-type fields (NEU-520).
function Harness({
  fieldValue,
  required = false,
  renderOption,
}: {
  fieldValue: unknown;
  required?: boolean;
  renderOption?: (option: (typeof OPTIONS)[number]) => React.ReactNode;
}) {
  const form = useForm<FieldValues>({ defaultValues: { task: fieldValue } });
  return (
    <Form {...form}>
      <FormFieldGroup {...form} name="task" label="Task" required={required}>
        <FormCombobox
          options={OPTIONS}
          placeholder="Select task"
          renderOption={renderOption}
        />
      </FormFieldGroup>
    </Form>
  );
}

const getTrigger = () => screen.getByRole("combobox");

describe("FormCombobox", () => {
  it("renders the placeholder when the field value is null", () => {
    render(<Harness fieldValue={null} />);
    expect(getTrigger().textContent).toContain("Select task");
  });

  it("renders the placeholder when the field value is undefined", () => {
    render(<Harness fieldValue={undefined} />);
    expect(getTrigger().textContent).toContain("Select task");
  });

  it("renders the matching option label for a string field value", () => {
    render(<Harness fieldValue="text-embedding" />);
    expect(getTrigger().textContent).toContain("Text Embedding");
  });

  it("resolves a BaseRecord field value to its id's option label", () => {
    render(<Harness fieldValue={{ id: "text-generation" }} />);
    expect(getTrigger().textContent).toContain("Text Generation");
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

    expect(screen.getByText("Text Generation status")).toBeTruthy();
    expect(screen.queryByTestId("combobox-option-check")).toBeNull();
  });

  it("keeps selection checks for the default option renderer", () => {
    render(<Harness fieldValue="text-generation" />);
    fireEvent.click(getTrigger());

    expect(screen.getAllByTestId("combobox-option-check")).toHaveLength(2);
  });

  // cmdk puts `data-selected` on the keyboard cursor, which starts on the first
  // row whatever the field holds — so a custom row that drops the check icon
  // needs its own indicator bound to the value, or the list shows none at all.
  it("marks the stored value, not the cmdk cursor, in custom option rows", () => {
    render(
      <Harness
        fieldValue="text-embedding"
        renderOption={(option) => <span>{option.label}</span>}
      />,
    );

    fireEvent.click(getTrigger());

    const rows = Array.from(
      document.querySelectorAll<HTMLElement>('[cmdk-item=""]'),
    );
    const cursorRow = rows.find(
      (row) => row.getAttribute("data-selected") === "true",
    );
    const markedRow = rows.find((row) =>
      row.className.includes("--nt-fill-outstanding-light"),
    );

    expect(markedRow?.textContent).toBe("Text Embedding");
    expect(cursorRow?.textContent).not.toBe("Text Embedding");
  });
});
