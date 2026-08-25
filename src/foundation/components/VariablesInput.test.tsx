import { fireEvent, render, screen } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import type { Schema } from "@/foundation/hooks/use-variables-input";
import { VariablesInput } from "./VariablesInput";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const objectSchema = {
  speculative_config: { type: "object", title: "Speculative Config" },
} as unknown as Schema;

const booleanSchema = {
  enable_prefix_cache: { type: "boolean", title: "Enable Prefix Cache" },
} as unknown as Schema;

function VariablesInputForm({
  defaultArgs = { speculative_config: { method: "mtp" } },
  onSubmit,
}: {
  defaultArgs?: Record<string, unknown>;
  onSubmit: (values: { args: Record<string, unknown> }) => void;
}) {
  const form = useForm<{ args: Record<string, unknown> }>({
    defaultValues: {
      args: defaultArgs,
    },
  });
  const args = form.watch("args");

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <VariablesInput
          name="args"
          value={args}
          onChange={(next) => form.setValue("args", next)}
          schema={objectSchema}
        />
        <button type="submit">Save</button>
      </form>
    </FormProvider>
  );
}

describe("VariablesInput", () => {
  it("renders existing object schema values as pretty JSON", () => {
    render(
      <VariablesInput
        value={{
          speculative_config: {
            method: "mtp",
            nested: { enabled: true },
          },
        }}
        onChange={vi.fn()}
        schema={objectSchema}
      />,
    );

    const textarea = screen.getByDisplayValue(
      /"method": "mtp"/,
    ) as HTMLTextAreaElement;

    expect(textarea.value).toContain('"method": "mtp"');
    expect(textarea.value).toContain('"nested": {\n    "enabled": true');
  });

  it("keeps invalid edits for existing object values without calling onChange", () => {
    const onChange = vi.fn();

    render(
      <VariablesInput
        value={{ speculative_config: { method: "mtp" } }}
        onChange={onChange}
        schema={objectSchema}
      />,
    );

    const textarea = screen.getByDisplayValue(
      /"method": "mtp"/,
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '{"method":' } });

    expect(textarea.value).toBe('{"method":');
    expect(onChange).not.toHaveBeenCalled();
    expect(
      screen.getByText("components.variablesInput.invalidJsonValue"),
    ).toBeTruthy();
  });

  it("updates existing object schema values as structured JSON", () => {
    const onChange = vi.fn();

    render(
      <VariablesInput
        value={{ speculative_config: { method: "mtp" } }}
        onChange={onChange}
        schema={objectSchema}
      />,
    );

    const textarea = screen.getByDisplayValue(
      /"method": "mtp"/,
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, {
      target: {
        value:
          '{"method":"eagle","num_speculative_tokens":2,"nested":{"enabled":true}}',
      },
    });

    expect(onChange).toHaveBeenCalledWith({
      speculative_config: {
        method: "eagle",
        num_speculative_tokens: 2,
        nested: { enabled: true },
      },
    });
  });

  it("saves a new object row synchronously when the value input blurs", () => {
    const onChange = vi.fn();
    render(
      <VariablesInput value={{}} onChange={onChange} schema={objectSchema} />,
    );

    fireEvent.change(screen.getAllByRole("textbox")[0], {
      target: { value: "speculative_config" },
    });
    const textarea = screen.getByDisplayValue("{}") as HTMLTextAreaElement;
    fireEvent.change(textarea, {
      target: { value: '{"method":"mtp","nested":{"enabled":true}}' },
    });
    fireEvent.blur(textarea);

    expect(onChange).toHaveBeenCalledWith({
      speculative_config: {
        method: "mtp",
        nested: { enabled: true },
      },
    });
  });

  it("renders new boolean rows as a checkbox and saves checked state", () => {
    const onChange = vi.fn();
    render(
      <VariablesInput value={{}} onChange={onChange} schema={booleanSchema} />,
    );

    fireEvent.change(screen.getAllByRole("textbox")[0], {
      target: { value: "enable_prefix_cache" },
    });
    const checkbox = screen.getByRole("checkbox");
    expect(screen.queryByRole("combobox")).toBeNull();

    fireEvent.click(checkbox);

    expect(onChange).toHaveBeenCalledWith({
      enable_prefix_cache: true,
    });
  });

  it("blocks form submission while an existing object value has invalid JSON", () => {
    const onSubmit = vi.fn();
    render(<VariablesInputForm onSubmit={onSubmit} />);

    const textarea = screen.getByDisplayValue(
      /"method": "mtp"/,
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '{"method":' } });
    fireEvent.click(screen.getByText("Save"));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByText("components.variablesInput.invalidJsonValue"),
    ).toBeTruthy();
  });

  it("blocks form submission when an existing object value starts as invalid JSON", () => {
    const onSubmit = vi.fn();
    render(
      <VariablesInputForm
        defaultArgs={{ speculative_config: '{"method":' }}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.click(screen.getByText("Save"));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByText("components.variablesInput.invalidJsonValue"),
    ).toBeTruthy();
  });

  it("blocks form submission while a new object row has invalid JSON", () => {
    const onSubmit = vi.fn();
    render(<VariablesInputForm defaultArgs={{}} onSubmit={onSubmit} />);

    fireEvent.change(screen.getAllByRole("textbox")[0], {
      target: { value: "speculative_config" },
    });
    const textarea = screen.getByDisplayValue("{}") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '{"method":' } });
    fireEvent.blur(textarea);
    fireEvent.click(screen.getByText("Save"));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByText("components.variablesInput.invalidJsonValue"),
    ).toBeTruthy();
  });
});

const imageSchema = {
  image: { type: "string", title: "Image" },
} as unknown as Schema;

function ValueInputForm({
  valueInputs,
  onSubmit,
}: {
  valueInputs?: Parameters<typeof VariablesInput>[0]["valueInputs"];
  onSubmit: (values: { args: Record<string, unknown> }) => void;
}) {
  const form = useForm<{ args: Record<string, unknown> }>({
    defaultValues: { args: { image: "my-workload:v1" } },
  });
  const args = form.watch("args");

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <VariablesInput
          name="args"
          value={args}
          onChange={(next) => form.setValue("args", next)}
          schema={imageSchema}
          valueInputs={valueInputs}
        />
        <button type="submit">Save</button>
      </form>
    </FormProvider>
  );
}

describe("VariablesInput value inputs", () => {
  it("hands the value to the input supplied for a key, and takes its answer", () => {
    render(
      <ValueInputForm
        onSubmit={vi.fn()}
        valueInputs={{
          image: ({ value, onChange }) => (
            <button
              type="button"
              data-testid="image-widget"
              onClick={() => onChange("picked:v2")}
            >
              {value}
            </button>
          ),
        }}
      />,
    );

    // The supplied input was given the current value...
    expect(screen.getByTestId("image-widget").textContent).toBe(
      "my-workload:v1",
    );

    // ...and what it answers becomes the value, which comes back to it.
    fireEvent.click(screen.getByTestId("image-widget"));

    expect(screen.getByTestId("image-widget").textContent).toBe("picked:v2");
  });

  it("falls back to the type's own input for a key the caller says nothing about", () => {
    render(<ValueInputForm onSubmit={vi.fn()} />);

    expect(screen.queryByTestId("image-widget")).toBeNull();
    expect(screen.getByDisplayValue("my-workload:v1")).not.toBeNull();
  });
});
