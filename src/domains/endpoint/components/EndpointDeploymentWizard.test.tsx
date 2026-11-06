import { fireEvent, render, screen } from "@testing-library/react";
import { type ComponentProps, useState } from "react";
import {
  type Control,
  type FieldValues,
  FormProvider,
  useForm,
} from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import { Input } from "@/components/ui/input";
import {
  makeEndpoint,
  makeReviewContext,
} from "@/domains/endpoint/testing/builders";
import type { Endpoint } from "@/domains/endpoint/types";
import { FormFieldGroup } from "@/foundation/components/FormFieldGroup";
import { EndpointDeploymentWizard } from "./EndpointDeploymentWizard";

vi.mock("./EndpointAdvancedParameters", () => ({
  EndpointAdvancedParameters: ({ variant }: { variant?: string }) => (
    <div data-testid="advanced-review">{variant}</div>
  ),
}));

const endpoint = makeEndpoint({
  spec: {
    replicas: { num: 2 },
    variables: { engine_args: { max_model_len: 32768 } },
  },
});

type WizardProps = ComponentProps<typeof EndpointDeploymentWizard<Endpoint>>;

function Harness({
  values = endpoint,
  ...props
}: Partial<Omit<WizardProps, "form" | "activeStep" | "onStepChange">> & {
  values?: Endpoint;
}) {
  const form = useForm<Endpoint>({ defaultValues: values });
  const [activeStep, setActiveStep] = useState(0);
  return (
    <EndpointDeploymentWizard
      form={form}
      activeStep={activeStep}
      onStepChange={setActiveStep}
      errorsByStep={{}}
      modelFields={<div>MODEL_FIELDS</div>}
      resourceFields={<div>RESOURCE_FIELDS</div>}
      runtimeFields={<div>RUNTIME_FIELDS</div>}
      advancedFields={<div>ADVANCED_FIELDS</div>}
      estimateFields={<div>ESTIMATE_FIELDS</div>}
      configurationFields={<div>CONFIGURATION_FIELDS</div>}
      reviewContext={makeReviewContext()}
      stepCompletions={{
        0: "complete",
        1: "complete",
        2: "in-progress",
        3: "complete",
      }}
      submitBlocked={false}
      {...props}
    />
  );
}

const openStep = (name: RegExp) =>
  fireEvent.click(screen.getByRole("button", { name }));

const openReview = () => openStep(/endpoints\.wizard\.steps\.confirm/);

function ControlledStepHarness() {
  const form = useForm<Endpoint>({ defaultValues: endpoint });
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
          <FormFieldGroup
            control={control}
            name="spec.engine.version"
            label="Engine Version"
          >
            <Input />
          </FormFieldGroup>
        }
        resourceFields={
          <FormFieldGroup control={control} name="spec.cluster" label="Cluster">
            <Input />
          </FormFieldGroup>
        }
        runtimeFields={null}
        advancedFields={null}
        estimateFields={null}
        configurationFields={null}
        reviewContext={makeReviewContext()}
        stepCompletions={{}}
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

  it("moves through the deployment steps", () => {
    render(<Harness />);

    screen.getByText("MODEL_FIELDS");
    openStep(/endpoints\.wizard\.steps\.resources/);
    screen.getByText("RESOURCE_FIELDS");
    openStep(/endpoints\.wizard\.steps\.runtime/);
    screen.getByText("RUNTIME_FIELDS");
  });

  it("does not carry a controller value into a differently named field", () => {
    render(<ControlledStepHarness />);

    expect(
      (screen.getByLabelText("Engine Version") as HTMLInputElement).value,
    ).toBe("0.31.0");

    openStep(/endpoints\.wizard\.steps\.resources/);

    expect((screen.getByLabelText("Cluster") as HTMLInputElement).value).toBe(
      "cluster-a",
    );
  });

  it("shows grouped review values and can return to a step", () => {
    render(
      <Harness
        reviewContext={makeReviewContext({
          catalogOrigin: {
            catalog: "qwen-catalog",
            variant: "fp8",
            features: [{ name: "context_window", value: "32768" }],
            featuresUnreadable: false,
          },
        })}
      />,
    );

    openReview();

    screen.getByText("endpoints.wizard.review.title");
    screen.getByText("chat");
    screen.getByText("default");
    screen.getByText("endpoints.wizard.review.model:qwen,2");
    screen.getByText(
      "endpoints.wizard.summary.catalog: qwen-catalog · endpoints.recipe.variant: fp8 · endpoints.recipe.features: context_window: 32768",
    );
    expect(screen.getByTestId("advanced-review").textContent).toBe("inline");
    fireEvent.click(
      screen.getAllByRole("button", {
        name: "endpoints.wizard.review.edit",
      })[0],
    );
    screen.getByText("MODEL_FIELDS");
  });

  it("shows deployment risks and requested against available capacity", () => {
    render(
      <Harness
        values={makeEndpoint({
          spec: {
            kv_cache: { provider: "zcache", options: { timeout_seconds: 5 } },
          },
        })}
        reviewContext={makeReviewContext({
          modelDelivery: "at-deploy-time",
          noVerifiedAccelerator: true,
          requiredVramGb: 32,
          clusterCapacity: [
            { key: "memory", requested: 1.5, available: 2.5, total: 4 },
          ],
        })}
      />,
    );

    openReview();

    screen.getByText("endpoints.messages.runtimeDownloadHint");
    screen.getByText(
      /^endpoints\.recipe\.noVerifiedAccelerator endpoints\.recipe\.requiredVram:/,
    );
    screen.getByText("1.5 endpoints.options.gib");
    screen.getByText("2.5 endpoints.options.gib");
    screen.getByText("endpoints.wizard.review.checkCacheEnabled");
  });

  it("shows unknown-delivery and unavailable-capacity risks together", () => {
    render(
      <Harness
        reviewContext={makeReviewContext({
          modelDelivery: "unknown",
          clusterCapacityUnavailable: true,
        })}
      />,
    );

    openReview();

    screen.getByText("endpoints.messages.runtimeDownloadUnknown");
    screen.getByText("endpoints.messages.clusterResourcesUnavailable");
  });

  it("omits the risks block and claims no checks before validation runs", () => {
    render(<Harness />);

    openReview();

    expect(screen.queryByText("endpoints.wizard.review.risks")).toBeNull();
    screen.getByText("endpoints.wizard.review.checksPending");
    expect(
      screen.queryByText(/^endpoints\.wizard\.review\.checkResources:/),
    ).toBeNull();
  });

  it("makes review checks reflect actual deployment issues", () => {
    render(
      <Harness
        errorsByStep={{ 1: ["Resources need attention"], 2: ["Runtime"] }}
        serverIssue={{ step: 4, message: "Server rejected the deployment" }}
      />,
    );

    openReview();

    screen.getByText("endpoints.wizard.review.issueCount:3");
    screen.getByText("endpoints.wizard.review.checkResourcesAttention");
    screen.getByText("endpoints.wizard.review.checkRuntimeAttention");
    screen.getByText("Server rejected the deployment");
  });

  it("does not surface a derived resource block before that step is visited", () => {
    render(<Harness submitBlocked />);

    expect(
      screen.queryByText(/endpoints\.wizard\.step\.needsAttention/),
    ).toBeNull();

    openStep(/endpoints\.wizard\.steps\.resources/);

    screen.getByText("endpoints.wizard.step.needsAttention:1");
  });

  it("marks valid create steps as completed and errors as attention", () => {
    render(<Harness errorsByStep={{ 1: ["Resources need attention"] }} />);

    openStep(/endpoints\.wizard\.steps\.runtime/);

    expect(
      screen.getAllByText("endpoints.wizard.step.completed").length,
    ).toBeGreaterThan(0);
    screen.getByText("endpoints.wizard.step.needsAttention:1");
  });

  it("distinguishes current, modified and unchanged steps in edit mode", () => {
    render(
      <Harness
        mode="edit"
        hasChanges
        modifiedSteps={new Set([1])}
        reviewChanges={[
          { step: 1, label: "common.fields.cpu", before: 6, after: 12 },
        ]}
      />,
    );

    const steps = screen.getAllByRole("button", {
      name: /endpoints\.wizard\.steps/,
    });
    expect(steps[0].textContent).toContain(
      "endpoints.wizard.step.currentConfiguration",
    );
    expect(steps[1].textContent).toContain("endpoints.wizard.step.modified");
    expect(steps[2].textContent).toContain("endpoints.wizard.step.unchanged");

    openReview();
    screen.getByText("endpoints.wizard.review.editTitle");
    screen.getByText("endpoints.wizard.review.redeployHint");
    screen.getByText("common.fields.cpu");
    screen.getByText("6");
    screen.getByText("12");
  });

  it("shows a no-change message instead of a redeploy warning", () => {
    render(<Harness mode="edit" hasChanges={false} reviewChanges={[]} />);

    openReview();

    screen.getByText("endpoints.wizard.review.noChanges");
    expect(
      screen.queryByText("endpoints.wizard.review.changesToSave"),
    ).toBeNull();
    expect(
      screen.queryByText("endpoints.wizard.review.redeployHint"),
    ).toBeNull();
  });
});
