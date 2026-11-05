import { fireEvent, render, screen, within } from "@testing-library/react";
import { type ReactNode, useState } from "react";
import {
  type Control,
  type FieldValues,
  FormProvider,
  useForm,
} from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import { Input } from "@/components/ui/input";
import type { EndpointReviewContext } from "@/domains/endpoint/lib/review-context";
import type { Endpoint } from "@/domains/endpoint/types";
import { FormFieldGroup } from "@/foundation/components/FormFieldGroup";
import { EndpointDeploymentWizard } from "./EndpointDeploymentWizard";

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key}:${JSON.stringify(options)}` : key,
  }),
}));

vi.mock("./EndpointAdvancedParameters", () => ({
  EndpointAdvancedParameters: ({ collapsible }: { collapsible?: boolean }) => (
    <div data-testid="advanced-review">{String(collapsible)}</div>
  ),
}));

const endpoint = {
  id: 0,
  api_version: "v1",
  kind: "Endpoint",
  metadata: { name: "chat", workspace: "default" },
  spec: {
    cluster: "cluster-a",
    model: { registry: "hf", name: "qwen", version: "", file: "", task: "" },
    replicas: { num: 2 },
    resources: { cpu: 4, memory: 8, gpu: 1 },
    engine: { engine: "vllm", version: "0.31.0" },
    variables: { engine_args: { max_model_len: 32768 } },
    env: {},
    kv_cache: null,
    deployment_options: null,
    config: null,
    image_registry: "",
  },
  status: null,
} as unknown as Endpoint;

const reviewContext: EndpointReviewContext = {
  catalogOrigin: {
    catalog: "qwen-catalog",
    variant: "fp8",
    features: [{ name: "context_window", value: "32768" }],
    featuresUnreadable: false,
  },
  modelDelivery: "at-deploy-time",
  noVerifiedAccelerator: true,
  requiredVramGb: 32,
  nodeCount: 2,
  clusterCapacity: [
    { key: "cpu", requested: 8, available: 48, total: 64 },
    { key: "memory", requested: 16, available: 192, total: 256 },
    { key: "cards", requested: 2, available: 6, total: 8 },
  ],
  clusterCapacityUnavailable: false,
};

function Harness({
  submitBlocked = false,
  mode = "create",
  modifiedSteps = new Set(),
  errorsByStep = {},
  serverIssue = null,
  context = reviewContext,
  hasChanges,
  values = endpoint,
  validationAttempted = false,
  estimateFields = <div>ESTIMATE_FIELDS</div>,
  configurationFields = <div>CONFIGURATION_FIELDS</div>,
  reviewChanges = [
    {
      step: 1,
      label: "common.fields.cpu",
      before: 4,
      after: 8,
    },
  ],
}: {
  submitBlocked?: boolean;
  mode?: "create" | "edit";
  modifiedSteps?: ReadonlySet<number>;
  errorsByStep?: Record<number, string[]>;
  serverIssue?: { step: number; message: string; path?: string } | null;
  context?: EndpointReviewContext;
  hasChanges?: boolean;
  values?: Endpoint;
  validationAttempted?: boolean;
  estimateFields?: ReactNode;
  configurationFields?: ReactNode;
  reviewChanges?: Array<{
    step: number;
    label: string;
    before: unknown;
    after: unknown;
    format?: "cache";
  }>;
}) {
  const form = useForm<Endpoint>({ defaultValues: values });
  const [activeStep, setActiveStep] = useState(0);
  return (
    <EndpointDeploymentWizard
      form={form}
      mode={mode}
      activeStep={activeStep}
      onStepChange={setActiveStep}
      modifiedSteps={modifiedSteps}
      errorsByStep={errorsByStep}
      modelFields={<div>MODEL_FIELDS</div>}
      resourceFields={<div>RESOURCE_FIELDS</div>}
      runtimeFields={<div>RUNTIME_FIELDS</div>}
      advancedFields={<div>ADVANCED_FIELDS</div>}
      estimateFields={estimateFields}
      configurationFields={configurationFields}
      reviewChanges={reviewChanges}
      hasChanges={hasChanges ?? mode === "edit"}
      reviewContext={context}
      stepCompletions={{
        0: "complete",
        1: "complete",
        2: "in-progress",
        3: "complete",
      }}
      serverIssue={serverIssue}
      submitBlocked={submitBlocked}
      validationAttempted={validationAttempted}
    />
  );
}

function ControlledStepHarness() {
  const form = useForm<Endpoint>({
    defaultValues: {
      ...endpoint,
      spec: {
        ...endpoint.spec,
        deployment_options: { scheduler: { type: "consistent_hash" } },
      },
    } as Endpoint,
  });
  const [activeStep, setActiveStep] = useState(0);
  const control = form.control as unknown as Control<FieldValues>;
  return (
    <FormProvider {...form}>
      <EndpointDeploymentWizard
        form={form}
        activeStep={activeStep}
        onStepChange={setActiveStep}
        errorsByStep={{}}
        modelFields={
          <>
            <FormFieldGroup
              control={control}
              name="spec.engine.engine"
              label="Engine"
            >
              <Input />
            </FormFieldGroup>
            <FormFieldGroup
              control={control}
              name="spec.engine.version"
              label="Engine Version"
            >
              <Input />
            </FormFieldGroup>
          </>
        }
        resourceFields={
          <>
            <FormFieldGroup
              control={control}
              name="spec.deployment_options.scheduler.type"
              label="Scheduler"
            >
              <Input />
            </FormFieldGroup>
            <FormFieldGroup
              control={control}
              name="spec.cluster"
              label="Cluster"
            >
              <Input />
            </FormFieldGroup>
          </>
        }
        runtimeFields={<div>RUNTIME_FIELDS</div>}
        advancedFields={<div>ADVANCED_FIELDS</div>}
        estimateFields={<div>ESTIMATE_FIELDS</div>}
        configurationFields={<div>CONFIGURATION_FIELDS</div>}
        reviewContext={reviewContext}
        stepCompletions={{
          0: "in-progress",
          1: "not-started",
          2: "not-started",
          3: "complete",
        }}
        submitBlocked={false}
      />
    </FormProvider>
  );
}

describe("EndpointDeploymentWizard", () => {
  it("switches between weights and the endpoint configuration summary", () => {
    render(<Harness />);

    screen.getByText("ESTIMATE_FIELDS");
    expect(screen.queryByText("CONFIGURATION_FIELDS")).toBeNull();

    fireEvent.mouseDown(
      screen.getByRole("tab", {
        name: "endpoints.wizard.summary.configuration",
      }),
      { button: 0 },
    );

    screen.getByText("CONFIGURATION_FIELDS");
    expect(screen.queryByText("ESTIMATE_FIELDS")).toBeNull();
  });

  it("renders fallback summary content and exceeded capacity", () => {
    const sparseValues = {
      ...endpoint,
      metadata: { name: "", workspace: "" },
      spec: {
        ...endpoint.spec,
        cluster: "",
        model: null,
        engine: {},
        resources: null,
        replicas: null,
        kv_cache: null,
        deployment_options: null,
        variables: null,
        env: null,
      },
    } as unknown as Endpoint;

    render(
      <Harness
        values={sparseValues}
        validationAttempted
        estimateFields={null}
        configurationFields={null}
        context={{
          ...reviewContext,
          modelDelivery: "already-local",
          noVerifiedAccelerator: true,
          requiredVramGb: null,
          catalogOrigin: {
            catalog: "catalog-a",
            variant: "",
            features: [{ name: "tool_choice" }],
            featuresUnreadable: true,
          },
          clusterCapacity: [
            { key: "cpu", requested: 2, available: null, total: null },
            { key: "cards", requested: 3, available: 1, total: 2 },
          ],
          clusterCapacityUnavailable: false,
        }}
        reviewChanges={[
          {
            step: 0,
            label: "common.fields.name",
            before: null,
            after: undefined,
          },
        ]}
      />,
    );

    screen.getAllByText("endpoints.wizard.summary.selectModel");
    fireEvent.click(
      screen.getByRole("button", {
        name: /endpoints.wizard.steps.confirm/,
      }),
    );

    screen.getByTestId("review-deployment-risks");
    screen.getAllByText("endpoints.origin.featuresUnreadable");
    expect(screen.getByTestId("review-catalog-origin").textContent).toContain(
      "tool_choice",
    );
    expect(
      screen.getByTestId("review-capacity-cards").getAttribute("data-state"),
    ).toBe("exceeded");
    expect(
      screen.getByTestId("deployment-checks").getAttribute("data-state"),
    ).toBe("clear");
  });

  it("omits the deployment risks block when nothing risky is known", () => {
    render(
      <Harness
        context={{
          ...reviewContext,
          catalogOrigin: null,
          modelDelivery: "already-local",
          noVerifiedAccelerator: false,
          clusterCapacity: [],
        }}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: /endpoints.wizard.steps.confirm/,
      }),
    );

    expect(screen.queryByTestId("review-deployment-risks")).toBeNull();
    expect(
      screen.getByTestId("deployment-checks").getAttribute("data-state"),
    ).toBe("unvalidated");
  });

  it("shows cache details and fractional capacity in the review", () => {
    render(
      <Harness
        values={{
          ...endpoint,
          spec: {
            ...endpoint.spec,
            kv_cache: { provider: "zcache", options: { timeout_seconds: 5 } },
          },
        }}
        context={{
          ...reviewContext,
          noVerifiedAccelerator: false,
          requiredVramGb: null,
          clusterCapacity: [
            { key: "memory", requested: 1.5, available: 2.5, total: 4 },
          ],
        }}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: /endpoints.wizard.steps.confirm/,
      }),
    );

    expect(screen.getByTestId("review-capacity-memory").textContent).toContain(
      "1.5",
    );
    expect(screen.getByTestId("deployment-checks").textContent).toContain(
      "endpoints.wizard.review.checkCacheEnabled",
    );
  });

  it("shows runtime issues and empty before/after review values", () => {
    render(
      <Harness
        mode="edit"
        hasChanges
        errorsByStep={{ 2: ["Runtime error"] }}
        reviewChanges={[
          {
            step: 2,
            label: "common.fields.engine",
            before: undefined,
            after: null,
          },
        ]}
        context={{
          ...reviewContext,
          noVerifiedAccelerator: false,
          requiredVramGb: null,
        }}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: /endpoints.wizard.steps.confirm/,
      }),
    );

    expect(screen.getByTestId("deployment-checks").textContent).toContain(
      "endpoints.wizard.review.checkRuntimeAttention",
    );
  });

  it("uses neutral runtime fallbacks when cache metadata is sparse", () => {
    render(
      <Harness
        values={{
          ...endpoint,
          spec: {
            ...endpoint.spec,
            engine: { engine: "", version: "" },
            kv_cache: { provider: "zcache", options: {} },
          },
        }}
        context={{ ...reviewContext, noVerifiedAccelerator: false }}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: /endpoints.wizard.steps.confirm/,
      }),
    );

    expect(screen.getByTestId("deployment-checks").textContent).toContain(
      "endpoints.wizard.review.checkCacheEnabled",
    );
  });

  it("renders advanced review values when only one parameter group exists", () => {
    const first = render(
      <Harness
        values={{
          ...endpoint,
          spec: {
            ...endpoint.spec,
            variables: null,
            env: { TOKEN: "secret" },
          },
        }}
        context={{ ...reviewContext, noVerifiedAccelerator: false }}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: /endpoints.wizard.steps.confirm/,
      }),
    );
    expect(screen.getByTestId("advanced-review").textContent).toBe("true");
    first.unmount();

    render(
      <Harness
        values={{
          ...endpoint,
          spec: {
            ...endpoint.spec,
            variables: { engine_args: { max_model_len: 4 } },
            env: null,
          },
        }}
        context={{ ...reviewContext, noVerifiedAccelerator: false }}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: /endpoints.wizard.steps.confirm/,
      }),
    );
  });

  it("moves through the five deployment steps", () => {
    render(<Harness />);

    screen.getByText("MODEL_FIELDS");
    screen.getByText("ESTIMATE_FIELDS");

    fireEvent.click(
      screen.getByRole("button", {
        name: /endpoints.wizard.steps.resources/,
      }),
    );
    screen.getByText("RESOURCE_FIELDS");

    fireEvent.click(
      screen.getByRole("button", {
        name: /endpoints.wizard.steps.runtime/,
      }),
    );
    screen.getByText("RUNTIME_FIELDS");
  });

  it("shows grouped review values and can return to a step", () => {
    render(<Harness />);

    fireEvent.click(
      screen.getByRole("button", {
        name: /endpoints.wizard.steps.confirm/,
      }),
    );

    screen.getByText("endpoints.wizard.review.title");
    expect(
      screen.getByTestId("review-endpoint-identity").textContent,
    ).toContain("chat");
    expect(
      screen.getByTestId("review-endpoint-identity").textContent,
    ).toContain("default");
    expect(screen.getAllByText(/qwen/).length).toBeGreaterThan(0);
    expect(screen.getByTestId("review-catalog-origin").textContent).toContain(
      "qwen-catalog",
    );
    expect(screen.getByTestId("review-catalog-origin").textContent).toContain(
      "context_window: 32768",
    );
    expect(screen.getByTestId("advanced-review").textContent).toBe("true");
    const reviewSurface = within(screen.getByTestId("review-single-surface"));
    reviewSurface.getByTestId("review-deployment-risks");
    reviewSurface.getByTestId("deployment-checks");
    reviewSurface.getByTestId("advanced-review");

    const editButtons = screen.getAllByRole("button", {
      name: "endpoints.wizard.review.edit",
    });
    fireEvent.click(editButtons[0]);
    screen.getByText("MODEL_FIELDS");
  });

  it("keeps deployment risks and requested capacity in review", () => {
    render(<Harness />);

    fireEvent.click(
      screen.getByRole("button", {
        name: /endpoints.wizard.steps.confirm/,
      }),
    );

    screen.getByTestId("review-runtime-download");
    expect(
      screen.getByTestId("review-unverified-accelerator").textContent,
    ).toContain("endpoints.recipe.requiredVram");
    expect(screen.getByTestId("review-capacity-cpu").textContent).toContain(
      "8",
    );
    expect(screen.getByTestId("review-capacity-cpu").textContent).toContain(
      "48",
    );
  });

  it("does not surface a derived resource block before that step is visited", () => {
    render(<Harness submitBlocked />);

    expect(
      screen.queryByText(/endpoints\.wizard\.step\.needsAttention/),
    ).toBeNull();

    fireEvent.click(
      screen.getByRole("button", {
        name: /endpoints.wizard.steps.resources/,
      }),
    );

    screen.getByText(/endpoints\.wizard\.step\.needsAttention/);
    expect(
      screen.queryByLabelText(/endpoints\.wizard\.summary\.issueCount/),
    ).toBeNull();
    expect(
      screen.queryByText("endpoints.wizard.issues.capacityBlocked"),
    ).toBeNull();
    expect(screen.getByTestId("endpoint-wizard-step-2").textContent).toBe("2");
  });

  it("shows unknown-delivery and unavailable-capacity risks together", () => {
    render(
      <Harness
        context={{
          ...reviewContext,
          modelDelivery: "unknown",
          clusterCapacity: null,
          clusterCapacityUnavailable: true,
        }}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: /endpoints.wizard.steps.confirm/,
      }),
    );

    screen.getByTestId("review-runtime-download-unknown");
    screen.getByTestId("review-capacity-unavailable");
  });

  it("does not carry a controller value into a differently named field", () => {
    render(<ControlledStepHarness />);

    expect(
      (screen.getByLabelText("Engine Version") as HTMLInputElement).value,
    ).toBe("0.31.0");

    fireEvent.click(
      screen.getByRole("button", {
        name: /endpoints.wizard.steps.resources/,
      }),
    );

    expect((screen.getByLabelText("Cluster") as HTMLInputElement).value).toBe(
      "cluster-a",
    );
  });

  it("distinguishes current, modified and unchanged steps in edit mode", () => {
    render(<Harness mode="edit" modifiedSteps={new Set([2])} />);

    const steps = screen.getAllByRole("button", {
      name: /endpoints\.wizard\.steps/,
    });
    expect(steps[0].textContent).toContain(
      "endpoints.wizard.step.currentConfiguration",
    );
    expect(steps[1].textContent).toContain("endpoints.wizard.step.unchanged");
    expect(steps[2].textContent).toContain("endpoints.wizard.step.modified");

    fireEvent.click(
      screen.getByRole("button", {
        name: /endpoints\.wizard\.steps\.confirm/,
      }),
    );
    screen.getByText("endpoints.wizard.review.editTitle");
    screen.getByText("endpoints.wizard.review.redeployHint");
    expect(screen.getByTestId("review-change-list").textContent).toContain(
      "common.fields.cpu",
    );
    expect(screen.getByTestId("review-change-list").textContent).toContain("4");
    expect(screen.getByTestId("review-change-list").textContent).toContain("8");
  });

  it("shows a no-change message instead of a redeploy warning", () => {
    render(<Harness mode="edit" hasChanges={false} reviewChanges={[]} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: /endpoints\.wizard\.steps\.confirm/,
      }),
    );

    screen.getByText("endpoints.wizard.review.noChanges");
    expect(screen.queryByTestId("review-change-list")).toBeNull();
    expect(
      screen.queryByText("endpoints.wizard.review.redeployHint"),
    ).toBeNull();
  });

  it("does not show a success icon before validation runs", () => {
    render(<Harness />);

    fireEvent.click(
      screen.getByRole("button", {
        name: /endpoints\.wizard\.steps\.confirm/,
      }),
    );

    expect(document.querySelector('[data-status="pending"]')).toBeTruthy();
    expect(document.querySelector('[data-status="clear"]')).toBeNull();
  });

  it("marks valid create steps as completed and errors as attention", () => {
    render(<Harness errorsByStep={{ 1: ["Resources need attention"] }} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: /endpoints.wizard.steps.resources/,
      }),
    );

    expect(
      screen.getAllByText(/endpoints.wizard.step.completed/).length,
    ).toBeGreaterThan(0);
    screen.getByText(/endpoints.wizard.step.needsAttention/);
  });

  it("makes review checks reflect actual deployment issues", () => {
    render(
      <Harness
        errorsByStep={{ 1: ["Resources need attention"] }}
        serverIssue={{ step: 4, message: "Server rejected the deployment" }}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: /endpoints.wizard.steps.confirm/,
      }),
    );

    expect(screen.getByTestId("deployment-checks").dataset.state).toBe(
      "issues",
    );
    screen.getByText("endpoints.wizard.review.checkResourcesAttention");
    expect(screen.getAllByText("Server rejected the deployment").length).toBe(
      1,
    );
  });
});
