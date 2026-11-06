import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { type FieldValues, FormProvider, useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import { selectOption } from "@/foundation/testing/interactions";
import { EndpointResolvedModelEditor } from "./EndpointResolvedModelEditor";

type EditorProps = ComponentProps<typeof EndpointResolvedModelEditor>;

function Harness(overrides: Partial<EditorProps> = {}) {
  const form = useForm<FieldValues>({
    defaultValues: {
      spec: {
        model: {
          registry: "hf",
          name: "org/model",
          version: "",
          file: "",
        },
      },
    },
  });

  const props: EditorProps = {
    direct: false,
    title: "Resolved model",
    control: form.control,
    values: {
      registry: "hf",
      name: "org/model",
      version: "",
      file: "",
    },
    sourceLabel: "Catalog",
    editing: false,
    customized: false,
    registryOptions: [{ label: "hf", value: "hf" }],
    registryLoading: false,
    modelOptions: [{ label: "org/model", value: "org/model" }],
    modelDisabled: false,
    allowReset: false,
    resetNotice: null,
    onToggleEditing: vi.fn(),
    onReset: vi.fn(),
    onUndo: vi.fn(),
    onRegistryChange: vi.fn(),
    onModelChange: vi.fn(),
    onModelSearchChange: vi.fn(),
    onVersionInput: vi.fn(),
    onFileInput: vi.fn(),
    ...overrides,
  };

  return (
    <FormProvider {...form}>
      <EndpointResolvedModelEditor {...props} />
    </FormProvider>
  );
}

describe("EndpointResolvedModelEditor", () => {
  it("offers to customize a catalog-resolved model", () => {
    render(<Harness />);

    screen.getByRole("button", {
      name: /endpoints\.resolvedModel\.customizeModel/,
    });
  });

  it("renders the editable direct fields and reports optional-field input", () => {
    const onRegistryChange = vi.fn();
    const onVersionInput = vi.fn();
    const onFileInput = vi.fn();
    render(
      <Harness
        direct
        editing
        onRegistryChange={onRegistryChange}
        onVersionInput={onVersionInput}
        onFileInput={onFileInput}
      />,
    );

    screen.getByTestId("endpoint-selected-model");
    screen.getByTestId("field-spec.model.name");

    selectOption("spec.model.registry", "hf");

    fireEvent.click(screen.getByTestId("model-optional-fields-toggle"));
    fireEvent.input(screen.getByLabelText("endpoints.fields.modelVersion"), {
      target: { value: "main" },
    });
    fireEvent.input(screen.getByLabelText("endpoints.fields.modelFile"), {
      target: { value: "model.safetensors" },
    });

    expect(onRegistryChange).toHaveBeenCalledOnce();
    expect(onVersionInput).toHaveBeenCalledOnce();
    expect(onFileInput).toHaveBeenCalledOnce();
  });

  it("shows resolved values, editing actions, reset guidance, and undo", () => {
    const onToggleEditing = vi.fn();
    const onReset = vi.fn();
    const onUndo = vi.fn();
    render(
      <Harness
        customized
        allowReset
        resetNotice={{ variant: "fp8", resetCount: 2 }}
        onToggleEditing={onToggleEditing}
        onReset={onReset}
        onUndo={onUndo}
      />,
    );

    const card = screen.getByTestId("endpoint-resolved-model");
    expect(card.textContent).toContain("endpoints.resolvedModel.custom");
    expect(card.textContent).toContain("endpoints.resolvedModel.auto");
    expect(card.textContent).toContain("org/model");
    expect(card.textContent).toContain("endpoints.resolvedModel.overrideHint");
    expect(card.textContent).toContain("endpoints.resolvedModel.switched:fp8");

    fireEvent.click(
      within(card).getByRole("button", {
        name: /endpoints\.resolvedModel\.editModel/,
      }),
    );
    fireEvent.click(
      within(card).getByRole("button", {
        name: "endpoints.resolvedModel.reset",
      }),
    );
    fireEvent.click(
      within(card).getByRole("button", {
        name: "endpoints.resolvedModel.undo",
      }),
    );

    expect(onToggleEditing).toHaveBeenCalledOnce();
    expect(onReset).toHaveBeenCalledOnce();
    expect(onUndo).toHaveBeenCalledOnce();
  });

  it("opens the resolved card in editing mode with a catalog source label", () => {
    render(<Harness editing />);

    const card = screen.getByTestId("endpoint-resolved-model");
    expect(card.textContent).toContain("Catalog");
    expect(card.textContent).toContain("endpoints.resolvedModel.doneEditing");
    within(card).getByTestId("field-spec.model.registry");
    within(card).getByTestId("field-spec.model.name");
  });
});
