import { render, screen } from "@testing-library/react";
import { type FieldValues, useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";

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
// explicit nulls for empty composite-type fields (NEU-520).
function Harness({ fieldValue }: { fieldValue: unknown }) {
  const form = useForm<FieldValues>({ defaultValues: { task: fieldValue } });
  return (
    <Form {...form}>
      <FormFieldGroup {...form} name="task" label="Task">
        <FormCombobox options={OPTIONS} placeholder="Select task" />
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
});
