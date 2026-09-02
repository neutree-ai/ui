import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import type { Schema } from "@/foundation/hooks/use-variables-input";
import { ResourceForm } from "./ResourceForm";
import { VariablesInput } from "./VariablesInput";

vi.mock("@refinedev/core", () => ({
  useBack: () => vi.fn(),
  useNavigation: () => ({ goBack: vi.fn() }),
  useResource: () => ({ action: "edit" }),
  useRouterType: () => "browser",
  useSaveButton: () => ({ label: "Save" }),
}));

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Element.prototype.scrollIntoView = vi.fn();

type TestValues = {
  name: string;
};

type VariablesFormValues = {
  args: Record<string, unknown>;
};

const variablesSchema = {
  speculative_config: { type: "object" },
  enable_prefix_cache: { type: "boolean" },
} as unknown as Schema;

function TestForm({ onFinish }: { onFinish: (values: TestValues) => void }) {
  const methods = useForm<TestValues>({
    defaultValues: { name: "initial" },
  });
  const formProps = {
    ...methods,
    getValues: vi.fn(() => ({ name: "stale" })),
    refineCore: {
      onFinish: vi.fn(async (values: TestValues) => onFinish(values)),
      formLoading: false,
    },
    saveButtonProps: {},
  } as unknown as Parameters<typeof ResourceForm<TestValues>>[0];

  return (
    <ResourceForm {...formProps} hideCancel>
      <input data-testid="name-input" {...methods.register("name")} />
    </ResourceForm>
  );
}

function VariablesForm({
  onFinish,
}: {
  onFinish: (values: VariablesFormValues) => void;
}) {
  const methods = useForm<VariablesFormValues>({
    defaultValues: { args: {} },
  });
  const args = methods.watch("args");
  const formProps = {
    ...methods,
    refineCore: {
      onFinish: vi.fn(async (values: VariablesFormValues) => onFinish(values)),
      formLoading: false,
    },
    saveButtonProps: {},
  } as unknown as Parameters<typeof ResourceForm<VariablesFormValues>>[0];

  return (
    <ResourceForm {...formProps} hideCancel>
      <VariablesInput
        name="args"
        value={args}
        onChange={(next) => methods.setValue("args", next)}
        schema={variablesSchema}
      />
    </ResourceForm>
  );
}

describe("ResourceForm", () => {
  it("keeps the sticky action bar flush with the form viewport bottom", () => {
    render(<TestForm onFinish={vi.fn()} />);

    const actionBar = screen.getByTestId("form-submit").parentElement;
    const content = actionBar?.parentElement;

    expect(actionBar?.className).toContain("sticky");
    expect(actionBar?.className).toContain("-bottom-2");
    expect(content?.className).not.toContain("pb-6");
  });

  it("submits the handleSubmit payload instead of reading getValues again", async () => {
    const onFinish = vi.fn();
    render(<TestForm onFinish={onFinish} />);

    fireEvent.change(screen.getByTestId("name-input"), {
      target: { value: "fresh" },
    });
    fireEvent.click(screen.getByTestId("form-submit"));

    await waitFor(() => {
      expect(onFinish).toHaveBeenCalledWith({ name: "fresh" });
    });
    expect(onFinish).not.toHaveBeenCalledWith({ name: "stale" });
  });

  it("flushes pending variable rows before submitting", async () => {
    const onFinish = vi.fn();
    render(<VariablesForm onFinish={onFinish} />);

    fireEvent.change(screen.getAllByRole("textbox")[0], {
      target: { value: "speculative_config" },
    });
    fireEvent.submit(screen.getByTestId("form"));

    await waitFor(() => {
      expect(onFinish).toHaveBeenCalledWith({
        args: { speculative_config: {} },
      });
    });
  });

  it("flushes pending boolean variable defaults before submitting", async () => {
    const onFinish = vi.fn();
    render(<VariablesForm onFinish={onFinish} />);

    fireEvent.change(screen.getAllByRole("textbox")[0], {
      target: { value: "enable_prefix_cache" },
    });
    fireEvent.submit(screen.getByTestId("form"));

    await waitFor(() => {
      expect(onFinish).toHaveBeenCalledWith({
        args: { enable_prefix_cache: false },
      });
    });
  });

  it("flushes multiple pending variable rows before submitting", async () => {
    const onFinish = vi.fn();
    render(<VariablesForm onFinish={onFinish} />);

    fireEvent.change(screen.getAllByRole("textbox")[0], {
      target: { value: "speculative_config" },
    });
    fireEvent.click(screen.getByText("components.variablesInput.addVariable"));
    fireEvent.change(
      screen.getAllByPlaceholderText(
        "components.variablesInput.selectOrTypeKey",
      )[1],
      {
        target: { value: "enable_prefix_cache" },
      },
    );
    fireEvent.submit(screen.getByTestId("form"));

    await waitFor(() => {
      expect(onFinish).toHaveBeenCalledWith({
        args: {
          speculative_config: {},
          enable_prefix_cache: false,
        },
      });
    });
  });

  it("blocks submit when a pending object row has invalid JSON", async () => {
    const onFinish = vi.fn();
    render(<VariablesForm onFinish={onFinish} />);

    fireEvent.change(screen.getAllByRole("textbox")[0], {
      target: { value: "speculative_config" },
    });
    fireEvent.change(screen.getByDisplayValue("{}"), {
      target: { value: '{"method":' },
    });
    fireEvent.submit(screen.getByTestId("form"));

    await waitFor(() => {
      expect(onFinish).not.toHaveBeenCalled();
      expect(
        screen.getByText("components.variablesInput.invalidJsonValue"),
      ).toBeTruthy();
    });
  });
});
