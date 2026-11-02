import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
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
  reviewChanges?: Array<{
    step: number;
    label: string;
    before: unknown;
    after: unknown;
    format?: "cache";
  }>;
}) {
  const form = useForm<Endpoint>({ defaultValues: endpoint });
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
      estimateFields={<div>ESTIMATE_FIELDS</div>}
      configurationFields={<div>CONFIGURATION_FIELDS</div>}
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

    expect(screen.getByText("ESTIMATE_FIELDS")).toBeTruthy();
    expect(screen.queryByText("CONFIGURATION_FIELDS")).toBeNull();

    fireEvent.mouseDown(
      screen.getByRole("tab", {
        name: "endpoints.wizard.summary.configuration",
      }),
      { button: 0 },
    );

    expect(screen.getByText("CONFIGURATION_FIELDS")).toBeTruthy();
    expect(screen.queryByText("ESTIMATE_FIELDS")).toBeNull();
  });

  it("moves through the five deployment steps", () => {
    render(<Harness />);

    expect(screen.getByText("MODEL_FIELDS")).toBeTruthy();
    expect(screen.getByText("ESTIMATE_FIELDS")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", {
        name: /endpoints.wizard.steps.resources/,
      }),
    );
    expect(screen.getByText("RESOURCE_FIELDS")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", {
        name: /endpoints.wizard.steps.runtime/,
      }),
    );
    expect(screen.getByText("RUNTIME_FIELDS")).toBeTruthy();
  });

  it("shows grouped review values and can return to a step", () => {
    render(<Harness />);

    fireEvent.click(
      screen.getByRole("button", {
        name: /endpoints.wizard.steps.confirm/,
      }),
    );

    expect(screen.getByText("endpoints.wizard.review.title")).toBeTruthy();
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
    expect(reviewSurface.getByTestId("review-deployment-risks")).toBeTruthy();
    expect(reviewSurface.getByTestId("deployment-checks")).toBeTruthy();
    expect(reviewSurface.getByTestId("advanced-review")).toBeTruthy();

    const editButtons = screen.getAllByRole("button", {
      name: "endpoints.wizard.review.edit",
    });
    fireEvent.click(editButtons[0]);
    expect(screen.getByText("MODEL_FIELDS")).toBeTruthy();
  });

  it("keeps deployment risks and requested capacity in review", () => {
    render(<Harness />);

    fireEvent.click(
      screen.getByRole("button", {
        name: /endpoints.wizard.steps.confirm/,
      }),
    );

    expect(screen.getByTestId("review-runtime-download")).toBeTruthy();
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

    expect(
      screen.getByText(/endpoints\.wizard\.step\.needsAttention/),
    ).toBeTruthy();
    expect(
      screen.queryByLabelText(/endpoints\.wizard\.summary\.issueCount/),
    ).toBeNull();
    expect(
      screen.queryByText("endpoints.wizard.issues.capacityBlocked"),
    ).toBeNull();
    expect(screen.getByTestId("endpoint-wizard-step-2").textContent).toBe("2");
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
    expect(screen.getByText("endpoints.wizard.review.editTitle")).toBeTruthy();
    expect(
      screen.getByText("endpoints.wizard.review.redeployHint"),
    ).toBeTruthy();
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

    expect(screen.getByText("endpoints.wizard.review.noChanges")).toBeTruthy();
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
    expect(
      screen.getByText(/endpoints.wizard.step.needsAttention/),
    ).toBeTruthy();
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
    expect(
      screen.getByText("endpoints.wizard.review.checkResourcesAttention"),
    ).toBeTruthy();
    expect(screen.getAllByText("Server rejected the deployment").length).toBe(
      1,
    );
  });
});
