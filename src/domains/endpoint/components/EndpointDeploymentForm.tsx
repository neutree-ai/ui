import { AlertTriangle, ArrowLeft, ArrowRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EndpointDeploymentWizard } from "@/domains/endpoint/components/EndpointDeploymentWizard";
import { useEndpointForm } from "@/domains/endpoint/hooks/use-endpoint-form";
import { endpointReviewChanges } from "@/domains/endpoint/lib/endpoint-review-changes";
import {
  type EndpointServerIssue,
  endpointErrorsByStep,
  endpointServerIssue,
  endpointStepValidationPaths,
  firstEndpointErrorStep,
} from "@/domains/endpoint/lib/endpoint-wizard";
import type { Endpoint } from "@/domains/endpoint/types";
import { EmptyState } from "@/foundation/components/EmptyState";
import { Loader } from "@/foundation/components/Loader";
import { ResourceForm } from "@/foundation/components/ResourceForm";
import { useTranslation } from "@/foundation/lib/i18n";

const NO_MODIFIED_STEPS = new Set<number>();

export function EndpointDeploymentForm({
  action,
}: {
  action: "create" | "edit";
}) {
  const [activeStep, setActiveStep] = useState(0);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [serverIssue, setServerIssue] = useState<EndpointServerIssue | null>(
    null,
  );
  const { t } = useTranslation();
  const {
    form,
    submitBlocked,
    editQuery,
    currentWorkspace,
    metadataFields,
    wizardProfileFields,
    templateFields,
    runtimeFields,
    wizardEstimateFields,
    configurationSummaryFields,
    reviewContext,
    wizardStepCompletions,
    resourceFields,
    customizeFields,
  } = useEndpointForm({
    action,
    layout: "wizard",
  });
  const editLoadFailed =
    action === "edit" &&
    editQuery != null &&
    !editQuery.isLoading &&
    (editQuery.isError || editQuery.data?.data == null);
  if (action === "edit" && editQuery?.isLoading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Loader className="w-12 text-muted-foreground" />
      </div>
    );
  }
  if (editLoadFailed) {
    const error = editQuery.error as
      | { code?: string | number; statusCode?: number; message?: string }
      | undefined;
    const notFound =
      String(error?.statusCode ?? error?.code ?? "") === "404" ||
      /not found/i.test(error?.message ?? "");
    return (
      <div className="mx-auto w-full max-w-[720px] space-y-4">
        <h1 className="text-2xl font-semibold leading-8 text-foreground">
          {t("endpoints.edit")}
        </h1>
        <EmptyState
          variant="page"
          role="alert"
          className="rounded-[var(--nt-radius-card)] border border-[var(--nt-stroke-neutral-trans-3)] bg-[var(--nt-fill-neutral-white)] px-6 py-12"
        >
          <AlertTriangle
            aria-hidden="true"
            className="mx-auto mb-4 size-8 text-[var(--nt-text-colorful-notice)]"
          />
          <h2 className="text-base font-semibold text-foreground">
            {t(
              notFound
                ? "endpoints.loadError.notFoundTitle"
                : "endpoints.loadError.failedTitle",
            )}
          </h2>
          <p className="mx-auto mt-2 max-w-[520px] text-sm text-muted-foreground">
            {t(
              notFound
                ? "endpoints.loadError.notFoundDescription"
                : "endpoints.loadError.failedDescription",
            )}
          </p>
          <Button asChild variant="outline" className="mt-6">
            <a href={`#/${currentWorkspace}/endpoints`}>
              {t("endpoints.loadError.backToList")}
            </a>
          </Button>
        </EmptyState>
      </div>
    );
  }
  const errorsByStep = endpointErrorsByStep(form.formState.errors);
  const reviewChanges =
    action === "edit" && editQuery?.data?.data
      ? endpointReviewChanges(
          form.watch() as unknown as Endpoint,
          editQuery.data.data as Endpoint,
        )
      : [];
  const modifiedSteps =
    action === "edit"
      ? new Set(reviewChanges.map((change) => change.step))
      : NO_MODIFIED_STEPS;
  const hasChanges = action === "edit" && reviewChanges.length > 0;
  const submitHint =
    action === "edit" && hasChanges
      ? t("endpoints.wizard.review.redeployDetails", {
          changes: reviewChanges.map((change) => t(change.label)).join(", "),
        })
      : undefined;
  const focusFirstInvalid = () => {
    window.setTimeout(() => {
      const invalid = document.querySelector<HTMLElement>(
        '[data-testid="form"] [aria-invalid="true"]',
      );
      invalid?.focus();
    }, 0);
  };
  const goToNextStep = async () => {
    const paths =
      endpointStepValidationPaths[
        activeStep as keyof typeof endpointStepValidationPaths
      ];
    const valid = paths.length === 0 || (await form.trigger([...paths]));
    if (!valid) {
      focusFirstInvalid();
      return;
    }
    setActiveStep((step) => Math.min(4, step + 1));
  };
  const modelFields =
    action === "create" ? (
      <>
        {metadataFields}
        {wizardProfileFields}
      </>
    ) : (
      <>
        {metadataFields}
        {templateFields}
      </>
    );

  return (
    <ResourceForm
      {...form}
      submitBlocked={submitBlocked || (action === "edit" && !hasChanges)}
      blockedSubmitMode="report"
      onBlockedSubmit={() => {
        if (action === "edit" && !hasChanges) return;
        setValidationAttempted(true);
        void form.handleSubmit(
          () => {
            setActiveStep(1);
            window.setTimeout(() => {
              document
                .querySelector<HTMLElement>(
                  '[data-testid="endpoint-current-request-panel"]',
                )
                ?.scrollIntoView({ block: "center" });
            }, 0);
          },
          (errors) => {
            const step = firstEndpointErrorStep(errors);
            if (step != null) {
              setActiveStep(step);
              focusFirstInvalid();
            }
          },
        )();
      }}
      onInvalid={(errors) => {
        setValidationAttempted(true);
        const step = firstEndpointErrorStep(errors);
        if (step != null) {
          setActiveStep(step);
          focusFirstInvalid();
        }
      }}
      onSubmitError={(error) => {
        setValidationAttempted(true);
        const issue = endpointServerIssue(
          error,
          t("endpoints.wizard.errors.serverFallback"),
        );
        setActiveStep(issue.step);
        if (issue.path) {
          form.setError(issue.path as never, {
            type: "server",
            message: issue.message,
          });
          setServerIssue(null);
        } else {
          setServerIssue(issue);
        }
        focusFirstInvalid();
      }}
      contentWidth="wide"
      cancelHref={`#/${currentWorkspace}/endpoints`}
      submitLabel={
        action === "create"
          ? t("endpoints.wizard.create")
          : hasChanges
            ? t("endpoints.wizard.saveAndRedeploy")
            : t("endpoints.wizard.save")
      }
      submitHint={submitHint}
      footerLeadingActions={
        activeStep > 0 ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => setActiveStep((step) => Math.max(0, step - 1))}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("endpoints.wizard.previous")}
          </Button>
        ) : null
      }
      footerActions={
        activeStep < 4 ? (
          <Button
            type="button"
            onClick={() => {
              void goToNextStep();
            }}
          >
            {t("endpoints.wizard.next")}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : null
      }
      title={t(
        action === "create" ? "endpoints.create" : "endpoints.edit",
        action === "create" ? "Create Endpoint" : "Edit Endpoint",
      )}
    >
      <EndpointDeploymentWizard
        form={form}
        mode={action}
        activeStep={activeStep}
        onStepChange={(step) => {
          setServerIssue(null);
          setActiveStep(step);
        }}
        modifiedSteps={modifiedSteps}
        errorsByStep={errorsByStep}
        modelFields={modelFields}
        resourceFields={resourceFields}
        runtimeFields={runtimeFields}
        advancedFields={customizeFields}
        estimateFields={wizardEstimateFields}
        configurationFields={configurationSummaryFields}
        reviewChanges={reviewChanges}
        hasChanges={hasChanges}
        reviewContext={reviewContext}
        stepCompletions={wizardStepCompletions}
        serverIssue={serverIssue}
        validationAttempted={validationAttempted}
        submitBlocked={submitBlocked}
      />
    </ResourceForm>
  );
}
