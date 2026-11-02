import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { endpointStepValidationPaths } from "@/domains/endpoint/lib/endpoint-wizard";
import { EndpointDeploymentForm } from "./EndpointDeploymentForm";

const baselineEndpoint = {
  metadata: { name: "deepseek-r1-multinode", workspace: "design-lab" },
  spec: {
    cluster: "gpu-k8s-west",
    replicas: { num: 1 },
    model: {
      registry: "huggingface",
      name: "deepseek-ai/DeepSeek-R1-Distill-Qwen-32B",
      version: "1.0",
      file: "model.safetensors",
      task: "text-generation",
    },
    engine: { engine: "vllm", version: "0.32.0" },
    resources: {
      cpu: 8,
      memory: 32,
      gpu: 1,
      accelerator: { type: "nvidia_gpu", product: "H100" },
    },
    kv_cache: null,
    deployment_options: { scheduler: { type: "consistent_hash" } },
    variables: { engine_args: { max_model_len: 32768 } },
    env: {},
  },
} as const;

const mocks = vi.hoisted(() => ({
  trigger: vi.fn(),
  submit: vi.fn(),
  dirtyFields: {} as Record<string, unknown>,
  values: {},
  query: undefined as
    | {
        data?: { data?: unknown };
        error?: unknown;
        isError?: boolean;
        isLoading?: boolean;
      }
    | undefined,
}));

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { changes?: string }) =>
      key.endsWith("redeployDetails") && options?.changes
        ? `${key}:${options.changes}`
        : key,
  }),
}));

vi.mock("@/domains/endpoint/hooks/use-endpoint-form", () => ({
  useEndpointForm: () => ({
    form: {
      formState: { errors: {}, dirtyFields: mocks.dirtyFields },
      handleSubmit: () => () => undefined,
      setError: vi.fn(),
      trigger: mocks.trigger,
      watch: () => mocks.values,
    },
    submitBlocked: false,
    editQuery: mocks.query,
    currentWorkspace: "design-lab",
    metadataFields: null,
    wizardProfileFields: null,
    templateFields: null,
    runtimeFields: null,
    wizardEstimateFields: null,
    configurationSummaryFields: null,
    wizardStepCompletions: {
      0: "not-started",
      1: "not-started",
      2: "not-started",
      3: "complete",
    },
    resourceFields: null,
    customizeFields: null,
  }),
}));

vi.mock("./EndpointDeploymentWizard", () => ({
  EndpointDeploymentWizard: ({
    activeStep,
    hasChanges,
    modifiedSteps,
    onStepChange,
  }: {
    activeStep: number;
    hasChanges: boolean;
    modifiedSteps: ReadonlySet<number>;
    onStepChange: (step: number) => void;
  }) => (
    <div>
      <output data-testid="active-step">{activeStep}</output>
      <output data-testid="has-changes">{String(hasChanges)}</output>
      <output data-testid="modified-steps">
        {[...modifiedSteps].join(",")}
      </output>
      <button type="button" onClick={() => onStepChange(4)}>
        go to review
      </button>
    </div>
  ),
}));

vi.mock("@/foundation/components/ResourceForm", () => ({
  ResourceForm: ({
    children,
    footerActions,
    hideSubmit,
    onBlockedSubmit,
    onSubmitError,
    submitBlocked,
    submitLabel,
    submitHint,
    cancelHref,
  }: {
    children: ReactNode;
    footerActions?: ReactNode;
    hideSubmit?: boolean;
    onBlockedSubmit?: () => void;
    onSubmitError?: (error: unknown) => void;
    submitBlocked?: boolean;
    submitLabel: string;
    submitHint?: string;
    cancelHref?: string;
  }) => (
    <div>
      {children}
      {footerActions}
      {cancelHref && (
        <a data-testid="form-cancel" href={cancelHref}>
          Cancel
        </a>
      )}
      {onSubmitError && (
        <button
          type="button"
          onClick={() =>
            onSubmitError({
              code: "10232",
              message: "Server rejected the engine",
            })
          }
        >
          reject server
        </button>
      )}
      {!hideSubmit && (
        <button
          type="button"
          onClick={submitBlocked ? onBlockedSubmit : mocks.submit}
        >
          {submitLabel}
        </button>
      )}
      {submitHint && (
        <button type="button" aria-label={submitHint}>
          hint
        </button>
      )}
    </div>
  ),
}));

describe("EndpointDeploymentForm", () => {
  afterEach(() => {
    mocks.query = undefined;
    mocks.dirtyFields = {};
    mocks.values = {};
    mocks.submit.mockReset();
    mocks.trigger.mockReset();
  });

  it.each(["create", "edit"] as const)(
    "validates only the step being left in %s mode",
    async (action) => {
      mocks.trigger.mockReset();
      mocks.trigger.mockResolvedValue(true);
      render(<EndpointDeploymentForm action={action} />);

      fireEvent.click(
        screen.getByRole("button", { name: "endpoints.wizard.next" }),
      );

      await screen.findByText("1", { selector: "output" });
      expect(mocks.trigger).toHaveBeenCalledWith(
        endpointStepValidationPaths[0],
      );
    },
  );

  it("does not validate when a step link opens the review", () => {
    mocks.trigger.mockReset();
    render(<EndpointDeploymentForm action="create" />);

    fireEvent.click(screen.getByRole("button", { name: "go to review" }));

    expect(mocks.trigger).not.toHaveBeenCalled();
    expect(screen.getByTestId("active-step").textContent).toBe("4");
  });

  it("stays on the current step when its scoped validation fails", async () => {
    mocks.trigger.mockReset();
    mocks.trigger.mockResolvedValue(false);
    render(<EndpointDeploymentForm action="create" />);

    fireEvent.click(
      screen.getByRole("button", { name: "endpoints.wizard.next" }),
    );

    expect(screen.getByTestId("active-step").textContent).toBe("0");
    expect(mocks.trigger).toHaveBeenCalledWith(endpointStepValidationPaths[0]);
  });

  it("keeps create available while reviewing any step", () => {
    render(<EndpointDeploymentForm action="create" />);

    screen.getByRole("button", { name: "endpoints.wizard.create" });
    fireEvent.click(screen.getByRole("button", { name: "go to review" }));
    expect(screen.getByTestId("active-step").textContent).toBe("4");
    screen.getByRole("button", { name: "endpoints.wizard.create" });
  });

  it("keeps edit save actionable without submitting when there are no changes", () => {
    render(<EndpointDeploymentForm action="edit" />);

    const save = screen.getByRole("button", {
      name: "endpoints.wizard.save",
    });
    expect(save.hasAttribute("disabled")).toBe(false);
    fireEvent.click(save);
    expect(mocks.submit).not.toHaveBeenCalled();
    expect(screen.getByTestId("active-step").textContent).toBe("0");
  });

  it("ignores historical dirty fields when the final values have no diff", () => {
    mocks.query = { data: { data: baselineEndpoint }, isLoading: false };
    mocks.values = structuredClone(baselineEndpoint);
    // React Hook Form can retain this after a value is edited and returned to
    // its original value. It is history, not proof that the endpoint differs.
    mocks.dirtyFields = { spec: { replicas: { num: true } } };
    render(<EndpointDeploymentForm action="edit" />);

    expect(screen.getByTestId("has-changes").textContent).toBe("false");
    expect(screen.getByTestId("modified-steps").textContent).toBe("");
    expect(
      screen.queryByRole("button", {
        name: "endpoints.wizard.review.redeployDetails",
      }),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "endpoints.wizard.save" }),
    );
    expect(mocks.submit).not.toHaveBeenCalled();
  });

  it("keeps edit save available from the first step when changes exist", () => {
    mocks.query = { data: { data: baselineEndpoint }, isLoading: false };
    mocks.values = {
      ...structuredClone(baselineEndpoint),
      spec: {
        ...baselineEndpoint.spec,
        replicas: { num: 2 },
        resources: { ...baselineEndpoint.spec.resources, cpu: 16 },
      },
    };
    mocks.dirtyFields = { spec: { resources: { cpu: true } } };
    render(<EndpointDeploymentForm action="edit" />);

    expect(screen.getByTestId("active-step").textContent).toBe("0");
    expect(screen.getByTestId("has-changes").textContent).toBe("true");
    expect(screen.getByTestId("modified-steps").textContent).toBe("0,1");
    screen.getByRole("button", {
      name: "endpoints.wizard.review.redeployDetails:endpoints.fields.replicas, common.fields.cpu",
    });
    expect(
      screen
        .getByRole("button", { name: "endpoints.wizard.saveAndRedeploy" })
        .hasAttribute("disabled"),
    ).toBe(false);
  });

  it.each(["create", "edit"] as const)(
    "routes Cancel to the endpoint list in %s mode",
    (action) => {
      render(<EndpointDeploymentForm action={action} />);

      expect(screen.getByTestId("form-cancel").getAttribute("href")).toBe(
        "#/design-lab/endpoints",
      );
    },
  );

  it("moves to the step mapped from a stable server error code", () => {
    render(<EndpointDeploymentForm action="create" />);

    fireEvent.click(screen.getByRole("button", { name: "reject server" }));

    expect(screen.getByTestId("active-step").textContent).toBe("2");
  });

  it("renders a page-level not-found state when an edit read fails", () => {
    mocks.query = {
      error: { statusCode: 404 },
      isError: true,
      isLoading: false,
    };

    render(<EndpointDeploymentForm action="edit" />);

    expect(screen.getByRole("alert").textContent).toContain(
      "endpoints.loadError.notFoundTitle",
    );
    expect(screen.queryByTestId("active-step")).toBeNull();
    expect(
      screen
        .getByRole("link", { name: "endpoints.loadError.backToList" })
        .getAttribute("href"),
    ).toBe("#/design-lab/endpoints");
  });

  it("distinguishes a generic edit read failure from not found", () => {
    mocks.query = {
      error: { message: "Gateway unavailable" },
      isError: true,
      isLoading: false,
    };

    render(<EndpointDeploymentForm action="edit" />);

    expect(screen.getByRole("alert").textContent).toContain(
      "endpoints.loadError.failedTitle",
    );
  });
});
