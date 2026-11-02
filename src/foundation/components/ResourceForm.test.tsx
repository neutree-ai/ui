import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import type { FieldValues } from "react-hook-form";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import type { Schema } from "@/foundation/hooks/use-variables-input";
import { FormFieldGroup } from "./FormFieldGroup";
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

function TestForm({
  onFinish,
  submitBlocked = false,
  blockedSubmitMode,
  onBlockedSubmit,
  onInvalid,
  onSubmitError,
  footerLeadingActions,
  footerActions,
  hideSubmit,
  cancelHref,
  contentWidth,
  submitHint,
}: {
  onFinish: (values: TestValues) => void | Promise<void>;
  submitBlocked?: boolean;
  blockedSubmitMode?: "disabled" | "report";
  onBlockedSubmit?: () => void;
  onInvalid?: (errors: Record<string, unknown>) => void;
  onSubmitError?: (error: unknown) => void;
  footerLeadingActions?: ReactNode;
  footerActions?: ReactNode;
  hideSubmit?: boolean;
  cancelHref?: string;
  contentWidth?: "default" | "wide";
  submitHint?: string;
}) {
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
    <ResourceForm
      {...formProps}
      hideCancel={!cancelHref}
      submitBlocked={submitBlocked}
      blockedSubmitMode={blockedSubmitMode}
      onBlockedSubmit={onBlockedSubmit}
      onInvalid={onInvalid}
      onSubmitError={onSubmitError}
      footerLeadingActions={footerLeadingActions}
      footerActions={footerActions}
      hideSubmit={hideSubmit}
      cancelHref={cancelHref}
      contentWidth={contentWidth}
      submitHint={submitHint}
    >
      <input
        data-testid="name-input"
        {...methods.register("name", { required: "Name is required" })}
      />
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

function OptionFieldsForm({
  onFinish,
  options,
}: {
  onFinish: () => void;
  options: number;
}) {
  const methods = useForm<FieldValues>({
    defaultValues: { name: "initial" },
  });
  const formProps = {
    ...methods,
    refineCore: {
      onFinish: vi.fn(async () => onFinish()),
      formLoading: false,
    },
    saveButtonProps: {},
  } as unknown as Parameters<typeof ResourceForm<FieldValues>>[0];

  return (
    <ResourceForm {...formProps} hideCancel>
      {Array.from({ length: options }, (_, index) => (
        <FormFieldGroup
          key={index}
          {...methods}
          name="name"
          label={`option-${index}`}
        >
          <input data-testid={`option-input-${index}`} />
        </FormFieldGroup>
      ))}
    </ResourceForm>
  );
}

describe("ResourceForm", () => {
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

  it("reports a blocked submit while keeping the button actionable", () => {
    const onFinish = vi.fn();
    const onBlockedSubmit = vi.fn();
    render(
      <TestForm
        onFinish={onFinish}
        submitBlocked
        blockedSubmitMode="report"
        onBlockedSubmit={onBlockedSubmit}
      />,
    );

    const button = screen.getByTestId("form-submit");
    expect(button.hasAttribute("disabled")).toBe(false);
    fireEvent.click(button);

    expect(onBlockedSubmit).toHaveBeenCalledOnce();
    expect(onFinish).not.toHaveBeenCalled();
  });

  it("reports validation errors when handleSubmit rejects the form", async () => {
    const onFinish = vi.fn();
    const onInvalid = vi.fn();
    render(<TestForm onFinish={onFinish} onInvalid={onInvalid} />);

    fireEvent.change(screen.getByTestId("name-input"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByTestId("form-submit"));

    await waitFor(() => expect(onInvalid).toHaveBeenCalledOnce());
    expect(onInvalid.mock.calls[0][0]).toHaveProperty("name");
    expect(onFinish).not.toHaveBeenCalled();
  });

  it("reports rejected submissions back to the owning form", async () => {
    const failure = new Error("server rejected the deployment");
    const onSubmitError = vi.fn();
    render(
      <TestForm
        onFinish={vi.fn().mockRejectedValue(failure)}
        onSubmitError={onSubmitError}
      />,
    );

    fireEvent.click(screen.getByTestId("form-submit"));

    await waitFor(() => expect(onSubmitError).toHaveBeenCalledWith(failure));
  });

  it("keeps wizard navigation in the shared action bar", () => {
    render(
      <TestForm
        onFinish={vi.fn()}
        footerLeadingActions={<button type="button">Previous</button>}
        footerActions={<button type="button">Next</button>}
      />,
    );

    const actionBar = screen.getByTestId("form-submit").parentElement;
    expect(actionBar?.textContent).toContain("Previous");
    expect(actionBar?.textContent).toContain("Next");
    expect(actionBar?.textContent).toContain("Save");
  });

  it("renders an accessible hint beside the primary submit action", () => {
    render(
      <TestForm
        onFinish={vi.fn()}
        submitHint="This will redeploy the endpoint."
      />,
    );

    screen.getByRole("button", {
      name: "This will redeploy the endpoint.",
    });
  });

  it("can hand the primary action to wizard navigation", () => {
    render(<TestForm onFinish={vi.fn()} hideSubmit />);

    expect(screen.queryByTestId("form-submit")).toBeNull();
  });

  it("can send Cancel to an explicit route", () => {
    render(<TestForm onFinish={vi.fn()} cancelHref="#/design-lab/endpoints" />);

    expect(screen.getByTestId("form-cancel").getAttribute("href")).toBe(
      "#/design-lab/endpoints",
    );
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
      screen.getByText("components.variablesInput.invalidJsonValue");
    });
  });

  it("refuses Enter from a field of a complex form", () => {
    render(<OptionFieldsForm onFinish={vi.fn()} options={2} />);

    const handled = fireEvent.keyDown(screen.getByTestId("option-input-0"), {
      key: "Enter",
    });

    expect(handled).toBe(false);
  });

  it("keeps Enter-to-submit in a single-option form", () => {
    render(<OptionFieldsForm onFinish={vi.fn()} options={1} />);

    const handled = fireEvent.keyDown(screen.getByTestId("option-input-0"), {
      key: "Enter",
    });

    expect(handled).toBe(true);
  });

  it("lets the submit button take Enter", () => {
    render(<OptionFieldsForm onFinish={vi.fn()} options={2} />);

    const handled = fireEvent.keyDown(screen.getByTestId("form-submit"), {
      key: "Enter",
    });

    expect(handled).toBe(true);
  });

  it("refuses the submit that follows a composing Enter", () => {
    const onFinish = vi.fn();
    render(<OptionFieldsForm onFinish={onFinish} options={2} />);

    const leftToIme = fireEvent.keyDown(screen.getByTestId("option-input-0"), {
      key: "Enter",
      isComposing: true,
    });
    fireEvent.submit(screen.getByTestId("form"));

    expect(leftToIme).toBe(true);
    expect(onFinish).not.toHaveBeenCalled();
  });
});
