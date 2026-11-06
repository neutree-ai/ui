import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { endpointStepValidationPaths } from "@/domains/endpoint/lib/endpoint-wizard";
import { makeEndpoint } from "@/domains/endpoint/testing/builders";
import { EndpointDeploymentForm } from "./EndpointDeploymentForm";

const baselineEndpoint = makeEndpoint();

const mocks = vi.hoisted(() => ({
  trigger: vi.fn(),
  submit: vi.fn(),
  setError: vi.fn(),
  setFocus: vi.fn(),
  formErrors: {} as Record<string, unknown>,
  submitBlocked: false,
  submitErrors: null as Record<string, unknown> | null,
  serverError: {
    code: "10232",
    message: "Server rejected the engine",
  } as unknown,
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

vi.mock("@/domains/endpoint/hooks/use-endpoint-form", () => ({
  useEndpointForm: () => ({
    form: {
      formState: { errors: mocks.formErrors, dirtyFields: mocks.dirtyFields },
      handleSubmit:
        (
          onValid: () => void,
          onInvalid: (errors: Record<string, unknown>) => void,
        ) =>
        () => {
          if (mocks.submitErrors) onInvalid(mocks.submitErrors);
          else onValid();
        },
      setError: mocks.setError,
      setFocus: mocks.setFocus,
      trigger: mocks.trigger,
      watch: () => mocks.values,
    },
    submitBlocked: mocks.submitBlocked,
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
    footerLeadingActions,
    footerActions,
    hideSubmit,
    onBlockedSubmit,
    onInvalid,
    onSubmitError,
    submitBlocked,
    submitLabel,
    submitHint,
    cancelHref,
  }: {
    children: ReactNode;
    footerLeadingActions?: ReactNode;
    footerActions?: ReactNode;
    hideSubmit?: boolean;
    onBlockedSubmit?: () => void;
    onInvalid?: (errors: Record<string, unknown>) => void;
    onSubmitError?: (error: unknown) => void;
    submitBlocked?: boolean;
    submitLabel: string;
    submitHint?: string;
    cancelHref?: string;
  }) => (
    <div>
      {children}
      {footerLeadingActions}
      {footerActions}
      {cancelHref && (
        <a data-testid="form-cancel" href={cancelHref}>
          Cancel
        </a>
      )}
      {onSubmitError && (
        <button type="button" onClick={() => onSubmitError(mocks.serverError)}>
          reject server
        </button>
      )}
      {onInvalid && (
        <button
          type="button"
          onClick={() =>
            onInvalid({
              spec: {
                engine: {
                  version: {
                    type: "required",
                    message: "Version is required",
                  },
                },
              },
            })
          }
        >
          invalid form
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
    mocks.submitBlocked = false;
    mocks.submitErrors = null;
    mocks.serverError = {
      code: "10232",
      message: "Server rejected the engine",
    };
    mocks.formErrors = {};
    mocks.submit.mockReset();
    mocks.setError.mockReset();
    mocks.setFocus.mockReset();
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
    mocks.values = makeEndpoint({
      spec: {
        replicas: { num: 2 },
        resources: { ...baselineEndpoint.spec.resources!, cpu: 16 },
      },
    });
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

  it("moves to the step mapped from a server error code", () => {
    render(<EndpointDeploymentForm action="create" />);

    fireEvent.click(screen.getByRole("button", { name: "reject server" }));

    expect(screen.getByTestId("active-step").textContent).toBe("2");
    expect(mocks.setError).not.toHaveBeenCalled();
  });

  it("puts a server error with a field path on that field", () => {
    mocks.serverError = {
      field: "spec.engine.version",
      message: "Unsupported engine version",
    };
    render(<EndpointDeploymentForm action="create" />);

    fireEvent.click(screen.getByRole("button", { name: "reject server" }));

    expect(screen.getByTestId("active-step").textContent).toBe("2");
    expect(mocks.setError).toHaveBeenCalledWith("spec.engine.version", {
      type: "server",
      message: "Unsupported engine version",
    });
  });

  it("moves to review after blocked submission validation succeeds", async () => {
    mocks.submitBlocked = true;
    render(<EndpointDeploymentForm action="create" />);

    fireEvent.click(
      screen.getByRole("button", { name: "endpoints.wizard.create" }),
    );

    await screen.findByText("1", { selector: "output" });
  });

  it("moves to the first invalid step after blocked submission validation fails", () => {
    mocks.submitBlocked = true;
    mocks.submitErrors = {
      spec: {
        cluster: { type: "required", message: "Cluster is required" },
      },
    };
    render(<EndpointDeploymentForm action="create" />);

    fireEvent.click(
      screen.getByRole("button", { name: "endpoints.wizard.create" }),
    );

    expect(screen.getByTestId("active-step").textContent).toBe("1");
  });

  it("moves to and focuses the first invalid field from invalid feedback", () => {
    mocks.formErrors = {
      spec: {
        engine: { version: { type: "required", message: "Version" } },
      },
    };
    render(<EndpointDeploymentForm action="create" />);

    fireEvent.click(screen.getByRole("button", { name: "invalid form" }));

    expect(screen.getByTestId("active-step").textContent).toBe("2");
    expect(mocks.setFocus).toHaveBeenCalledWith("spec.engine.version");
  });

  it("returns to the previous step from the wizard footer", async () => {
    mocks.trigger.mockResolvedValue(true);
    render(<EndpointDeploymentForm action="create" />);

    fireEvent.click(
      screen.getByRole("button", { name: "endpoints.wizard.next" }),
    );
    await screen.findByText("1", { selector: "output" });
    fireEvent.click(
      screen.getByRole("button", { name: "endpoints.wizard.previous" }),
    );

    expect(screen.getByTestId("active-step").textContent).toBe("0");
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

  it("shows the loading state while an edit query is unresolved", () => {
    mocks.query = { isLoading: true };

    render(<EndpointDeploymentForm action="edit" />);

    expect(screen.queryByTestId("active-step")).toBeNull();
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
