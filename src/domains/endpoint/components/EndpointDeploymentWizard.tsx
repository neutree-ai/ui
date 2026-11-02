import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EndpointAdvancedParameters } from "@/domains/endpoint/components/EndpointAdvancedParameters";
import {
  type EndpointReviewChange,
  formatEndpointReviewValue,
} from "@/domains/endpoint/lib/endpoint-review-changes";
import {
  type EndpointDeploymentIssue,
  type EndpointServerIssue,
  type EndpointStepCompletions,
  type EndpointWizardErrors,
  endpointWizardIssues,
} from "@/domains/endpoint/lib/endpoint-wizard";
import type {
  EndpointReviewCapacityMetric,
  EndpointReviewContext,
} from "@/domains/endpoint/lib/review-context";
import type { Endpoint } from "@/domains/endpoint/types";
import { EmptyValue } from "@/foundation/components/EmptyValue";
import { FormSectionStack } from "@/foundation/components/FormSectionStack";
import { useTranslation } from "@/foundation/lib/i18n";
import { formatToDecimal } from "@/foundation/lib/unit";
import { cn } from "@/foundation/lib/utils";
import { formatGb } from "@/foundation/recipe/vram";

const STEP_KEYS = [
  "endpoints.wizard.steps.model",
  "endpoints.wizard.steps.resources",
  "endpoints.wizard.steps.runtime",
  "endpoints.wizard.steps.advanced",
  "endpoints.wizard.steps.confirm",
] as const;

type EndpointDeploymentWizardProps<T extends FieldValues = FieldValues> = {
  form: UseFormReturn<T>;
  mode?: "create" | "edit";
  activeStep: number;
  onStepChange: (step: number) => void;
  modifiedSteps?: ReadonlySet<number>;
  errorsByStep: EndpointWizardErrors;
  modelFields: ReactNode;
  resourceFields: ReactNode;
  runtimeFields: ReactNode;
  advancedFields: ReactNode;
  estimateFields: ReactNode;
  configurationFields: ReactNode;
  reviewChanges?: EndpointReviewChange[];
  hasChanges?: boolean;
  reviewContext: EndpointReviewContext;
  stepCompletions: EndpointStepCompletions;
  serverIssue?: EndpointServerIssue | null;
  validationAttempted?: boolean;
  submitBlocked: boolean;
};

function DeploymentSummary<T extends FieldValues>({
  form,
  estimateFields,
  configurationFields,
}: {
  form: UseFormReturn<T>;
  estimateFields: ReactNode;
  configurationFields: ReactNode;
}) {
  const { t } = useTranslation();
  const values = form.watch() as unknown as Endpoint;
  const hasModel = Boolean(values.spec.model?.name);

  return (
    <aside
      className="rounded-lg border bg-[var(--nt-fill-neutral-white)] p-4 xl:sticky xl:top-4 xl:self-start"
      aria-label={t("endpoints.wizard.summary.title")}
    >
      <Tabs defaultValue="weights">
        <TabsList
          className="grid w-full grid-cols-2"
          aria-label={t("endpoints.wizard.summary.title")}
        >
          <TabsTrigger value="weights" className="px-2 text-xs">
            {t("endpoints.sections.weights")}
          </TabsTrigger>
          <TabsTrigger value="configuration" className="px-2 text-xs">
            {t("endpoints.wizard.summary.configuration")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="weights" className="mt-3 space-y-4">
          {hasModel ? (
            estimateFields
          ) : (
            <p className="rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              {t("endpoints.wizard.summary.selectModel")}
            </p>
          )}
        </TabsContent>

        <TabsContent value="configuration" className="mt-3">
          {configurationFields ?? (
            <p className="text-sm text-muted-foreground">
              {t("endpoints.wizard.summary.selectModel")}
            </p>
          )}
        </TabsContent>
      </Tabs>
    </aside>
  );
}

const CAPACITY_LABELS: Record<
  EndpointReviewCapacityMetric["key"],
  { label: string; unit: string }
> = {
  cpu: {
    label: "common.fields.cpu",
    unit: "pages.vramCalculator.metrics.cores",
  },
  memory: { label: "common.fields.memory", unit: "endpoints.options.gib" },
  cards: {
    label: "endpoints.fields.physicalGpu",
    unit: "endpoints.fields.cards",
  },
  vram: { label: "clusters.fields.memoryUsage", unit: "endpoints.options.gib" },
  core: { label: "clusters.fields.coreUsage", unit: "" },
};

const formatCapacityValue = (value: number | null) =>
  value == null ? (
    <EmptyValue />
  ) : (
    formatToDecimal(value, Number.isInteger(value) ? 0 : 1)
  );

function CatalogOriginValue({
  catalog,
  variant,
  features = [],
}: {
  catalog: string;
  variant?: string;
  features?: ReadonlyArray<{ name: string; value?: string }>;
}) {
  const { t } = useTranslation();
  const featureText = features
    .map((feature) =>
      feature.value === undefined
        ? feature.name
        : `${feature.name}: ${feature.value}`,
    )
    .join(", ");

  return (
    <span className="break-words">
      {t("endpoints.wizard.summary.catalog")}: {catalog}
      {variant && (
        <>
          {" · "}
          {t("endpoints.recipe.variant", "Variant")}: {variant}
        </>
      )}
      {featureText && (
        <>
          {" · "}
          {t("endpoints.recipe.features", "Features")}: {featureText}
        </>
      )}
    </span>
  );
}

function ReviewRisks({
  reviewContext,
}: {
  reviewContext: EndpointReviewContext;
}) {
  const { t } = useTranslation();
  const risks: Array<{ key: string; content: ReactNode }> = [];

  if (reviewContext.modelDelivery === "at-deploy-time") {
    risks.push({
      key: "download",
      content: (
        <p data-testid="review-runtime-download">
          {t("endpoints.messages.runtimeDownloadHint")}
        </p>
      ),
    });
  }
  if (reviewContext.modelDelivery === "unknown") {
    risks.push({
      key: "download-unknown",
      content: (
        <p data-testid="review-runtime-download-unknown">
          {t("endpoints.messages.runtimeDownloadUnknown")}
        </p>
      ),
    });
  }
  if (reviewContext.noVerifiedAccelerator) {
    const required =
      reviewContext.requiredVramGb == null
        ? ""
        : ` ${t("endpoints.recipe.requiredVram", {
            gb: formatGb(reviewContext.requiredVramGb),
          })}`;
    risks.push({
      key: "unverified",
      content: (
        <p data-testid="review-unverified-accelerator">
          {t("endpoints.recipe.noVerifiedAccelerator")}
          {required}
        </p>
      ),
    });
  }
  if (reviewContext.clusterCapacityUnavailable) {
    risks.push({
      key: "capacity-unavailable",
      content: (
        <p data-testid="review-capacity-unavailable">
          {t("endpoints.messages.clusterResourcesUnavailable")}
        </p>
      ),
    });
  }

  const capacity = reviewContext.clusterCapacity;
  if (risks.length === 0 && (!capacity || capacity.length === 0)) return null;

  return (
    <section className="px-4 py-3" data-testid="review-deployment-risks">
      <h2 className="text-sm font-semibold">
        {t("endpoints.wizard.review.risks", "Deployment risks")}
      </h2>
      {risks.length > 0 && (
        <div className="mt-2 space-y-2 text-sm text-[var(--nt-text-colorful-notice)]">
          {risks.map((risk) => (
            <div key={risk.key} className="flex items-start gap-2">
              <AlertTriangle
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
              />
              {risk.content}
            </div>
          ))}
        </div>
      )}
      {capacity && capacity.length > 0 && (
        <div className="mt-3">
          <h3 className="text-xs font-medium text-muted-foreground">
            {t(
              "endpoints.wizard.review.capacity",
              "Request vs available capacity",
            )}
          </h3>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {capacity.map((metric) => {
              const labels = CAPACITY_LABELS[metric.key];
              const capacityExceeded =
                metric.available != null && metric.requested > metric.available;
              return (
                <div
                  key={metric.key}
                  className={cn(
                    "rounded-md border px-3 py-2",
                    capacityExceeded &&
                      "border-destructive/40 bg-destructive/5",
                  )}
                  data-testid={`review-capacity-${metric.key}`}
                  data-state={capacityExceeded ? "exceeded" : "within-capacity"}
                >
                  <div className="text-xs font-medium">{t(labels.label)}</div>
                  <dl className="mt-1 grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-0.5 text-xs">
                    <dt className="text-muted-foreground">
                      {t("endpoints.wizard.review.requested", "Requested")}
                    </dt>
                    <dd
                      className={cn(
                        "text-right font-medium tabular-nums",
                        capacityExceeded && "text-destructive",
                      )}
                    >
                      {formatCapacityValue(metric.requested)}
                      {labels.unit && ` ${t(labels.unit)}`}
                    </dd>
                    <dt className="text-muted-foreground">
                      {t("endpoints.wizard.review.available", "Available")}
                    </dt>
                    <dd className="text-right font-medium tabular-nums">
                      {formatCapacityValue(metric.available)}
                      {metric.available != null &&
                        labels.unit &&
                        ` ${t(labels.unit)}`}
                    </dd>
                  </dl>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

function ReviewStep<T extends FieldValues>({
  form,
  mode,
  onStepChange,
  errorsByStep,
  issues,
  validationAttempted,
  reviewContext,
  reviewChanges,
  hasChanges,
}: {
  form: UseFormReturn<T>;
  mode: "create" | "edit";
  onStepChange: (step: number) => void;
  errorsByStep: EndpointWizardErrors;
  issues: EndpointDeploymentIssue[];
  validationAttempted: boolean;
  reviewContext: EndpointReviewContext;
  reviewChanges: EndpointReviewChange[];
  hasChanges: boolean;
}) {
  const { t } = useTranslation();
  const values = form.watch() as unknown as Endpoint;
  const engine = values.spec.engine;
  const resources = values.spec.resources;
  const cache = values.spec.kv_cache;
  const advanced = values.spec.deployment_options?.scheduler?.type;
  const resourceIssues = issues.filter((issue) => issue.step === 1);
  const runtimeIssues = issues.filter((issue) => issue.step === 2);
  const reviewIssues = issues.filter((issue) => issue.step >= 4);
  const hasAdvancedReviewContent =
    Object.keys(values.spec.variables?.engine_args ?? {}).length > 0 ||
    Object.keys(values.spec.env ?? {}).length > 0;
  const groups = [
    {
      step: 0,
      label: t("endpoints.wizard.steps.model"),
      value: t("endpoints.wizard.review.model", {
        model: values.spec.model?.name || "—",
        count: values.spec.replicas?.num ?? 1,
      }),
    },
    {
      step: 1,
      label: t("endpoints.wizard.steps.resources"),
      value: t("endpoints.wizard.review.resources", {
        cluster: values.spec.cluster || "—",
        count: values.spec.replicas?.num ?? 1,
        cpu: resources?.cpu ?? 0,
        memory: resources?.memory ?? 0,
        gpu: resources?.gpu ?? 0,
      }),
    },
    {
      step: 2,
      label: t("endpoints.wizard.steps.runtime"),
      value: cache
        ? t("endpoints.wizard.review.runtimeCache", {
            engine: engine?.engine || "—",
            version: engine?.version || "—",
            timeout: cache.options?.timeout_seconds ?? 5,
          })
        : t("endpoints.wizard.review.runtimeNoCache", {
            engine: engine?.engine || "—",
            version: engine?.version || "—",
          }),
    },
    {
      step: 3,
      label: t("endpoints.wizard.steps.advanced"),
      value: t("endpoints.wizard.review.advanced", {
        scheduler: advanced || "consistent_hash",
        engine: Object.keys(values.spec.variables?.engine_args ?? {}).length,
        environment: Object.keys(values.spec.env ?? {}).length,
      }),
    },
  ];

  return (
    <div className="space-y-4">
      <div
        className="divide-y overflow-hidden rounded-lg border bg-[var(--nt-fill-neutral-white)]"
        data-testid="review-single-surface"
      >
        <section>
          <div className="border-b px-4 py-3">
            <h2 className="text-base font-semibold">
              {t(
                mode === "edit"
                  ? "endpoints.wizard.review.editTitle"
                  : "endpoints.wizard.review.title",
              )}
            </h2>
            {mode === "edit" && (
              <p className="mt-1 text-xs text-muted-foreground">
                {hasChanges
                  ? t("endpoints.wizard.review.redeployHint")
                  : t("endpoints.wizard.review.noChanges")}
              </p>
            )}
          </div>
          {mode === "edit" && hasChanges && reviewChanges.length > 0 && (
            <section
              className="border-b px-4 py-3"
              data-testid="review-change-list"
            >
              <h3 className="text-sm font-semibold">
                {t("endpoints.wizard.review.changesToSave")}
              </h3>
              <dl className="mt-2 grid gap-2">
                {reviewChanges.map((change) => (
                  <div
                    key={`${change.step}:${change.label}`}
                    className="grid gap-1 rounded-md bg-muted/30 px-3 py-2 sm:grid-cols-[minmax(120px,0.8fr)_minmax(0,2fr)] sm:items-center"
                  >
                    <dt className="text-xs font-medium">{t(change.label)}</dt>
                    <dd className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs">
                      <span className="sr-only">
                        {t("endpoints.wizard.review.before")}
                      </span>
                      <span className="max-w-full break-all rounded bg-background px-1.5 py-0.5 font-mono text-muted-foreground">
                        {formatEndpointReviewValue(
                          change.before,
                          change.format,
                        ) || <EmptyValue />}
                      </span>
                      <ArrowRight
                        aria-hidden="true"
                        className="size-3.5 shrink-0 text-muted-foreground"
                      />
                      <span className="sr-only">
                        {t("endpoints.wizard.review.after")}
                      </span>
                      <span className="max-w-full break-all rounded bg-background px-1.5 py-0.5 font-mono font-medium">
                        {formatEndpointReviewValue(
                          change.after,
                          change.format,
                        ) || <EmptyValue />}
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
          <div
            className="grid gap-3 border-b px-4 py-3 sm:grid-cols-2"
            data-testid="review-endpoint-identity"
          >
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">
                {t("common.fields.name")}
              </div>
              <div className="mt-0.5 break-all text-sm font-semibold">
                {values.metadata?.name || <EmptyValue />}
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">
                {t("common.fields.workspace")}
              </div>
              <div className="mt-0.5 break-all text-sm font-semibold">
                {values.metadata?.workspace || <EmptyValue />}
              </div>
            </div>
          </div>
          <div>
            {groups.map((group) => {
              const errors = errorsByStep[group.step] ?? [];
              return (
                <div
                  key={group.step}
                  className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(110px,0.8fr)_minmax(0,2fr)_auto] sm:items-center"
                >
                  <div className="text-sm font-medium">{group.label}</div>
                  <div className="min-w-0 text-sm text-muted-foreground">
                    <p className="break-words">{group.value}</p>
                    {group.step === 0 && reviewContext.catalogOrigin && (
                      <p
                        className="mt-1 break-words text-xs text-muted-foreground"
                        data-testid="review-catalog-origin"
                      >
                        {t("endpoints.wizard.summary.catalog")}:{" "}
                        <CatalogOriginValue
                          catalog={reviewContext.catalogOrigin.catalog}
                          variant={reviewContext.catalogOrigin.variant}
                          features={reviewContext.catalogOrigin.features}
                        />
                        {reviewContext.catalogOrigin.featuresUnreadable && (
                          <span>
                            {" "}
                            {t("endpoints.origin.featuresUnreadable")}
                          </span>
                        )}
                      </p>
                    )}
                    {errors.length > 0 && (
                      <p className="mt-1 flex items-start gap-1 text-destructive">
                        <AlertCircle
                          aria-hidden="true"
                          className="mt-0.5 h-3.5 w-3.5 shrink-0"
                        />
                        {errors.join(" · ")}
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="w-fit px-0"
                    onClick={() => onStepChange(group.step)}
                  >
                    {t("endpoints.wizard.review.edit")}
                  </Button>
                </div>
              );
            })}
          </div>
        </section>

        <ReviewRisks reviewContext={reviewContext} />

        <section className="px-4 py-3">
          <h2 className="text-sm font-semibold">
            {t("endpoints.wizard.review.checks")}
          </h2>
          <div
            className="mt-2 space-y-2 text-sm text-muted-foreground"
            data-testid="deployment-checks"
            data-state={
              issues.length > 0
                ? "issues"
                : validationAttempted
                  ? "clear"
                  : "unvalidated"
            }
          >
            {issues.length > 0 && (
              <p className="flex items-start gap-2 text-destructive">
                <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4" />
                {t("endpoints.wizard.review.issueCount", {
                  count: issues.length,
                })}
              </p>
            )}
            <p className="flex items-start gap-2">
              {resourceIssues.length > 0 ? (
                <AlertTriangle
                  aria-hidden="true"
                  data-status="attention"
                  className="mt-0.5 h-4 w-4 shrink-0 text-[var(--nt-text-colorful-notice)]"
                />
              ) : !validationAttempted ? (
                <Circle
                  aria-hidden="true"
                  data-status="pending"
                  className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                />
              ) : (
                <CheckCircle2
                  aria-hidden="true"
                  data-status="clear"
                  className="mt-0.5 h-4 w-4 shrink-0 text-[var(--nt-text-colorful-positive)]"
                />
              )}
              {resourceIssues.length > 0
                ? t("endpoints.wizard.review.checkResourcesAttention")
                : !validationAttempted
                  ? t("endpoints.wizard.review.checksPending")
                  : t("endpoints.wizard.review.checkResources", {
                      count: values.spec.replicas?.num ?? 1,
                    })}
            </p>
            <p className="flex items-start gap-2">
              {runtimeIssues.length > 0 ? (
                <AlertTriangle
                  aria-hidden="true"
                  className="mt-0.5 h-4 w-4 shrink-0 text-[var(--nt-text-colorful-notice)]"
                />
              ) : cache ? (
                <CheckCircle2
                  aria-hidden="true"
                  className="mt-0.5 h-4 w-4 shrink-0 text-[var(--nt-text-colorful-positive)]"
                />
              ) : (
                <Circle
                  aria-hidden="true"
                  className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                />
              )}
              {runtimeIssues.length > 0
                ? t("endpoints.wizard.review.checkRuntimeAttention")
                : cache
                  ? t("endpoints.wizard.review.checkCacheEnabled")
                  : t("endpoints.wizard.review.checkCacheDisabled")}
            </p>
            {reviewIssues.length > 0 && (
              <p className="flex items-start gap-2 text-destructive">
                <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4" />
                {reviewIssues.map((issue) => issue.message).join(" · ")}
              </p>
            )}
          </div>
        </section>

        {hasAdvancedReviewContent && (
          <div className="px-4 py-3">
            <EndpointAdvancedParameters
              engineParameters={
                (values.spec.variables?.engine_args ?? null) as Record<
                  string,
                  unknown
                > | null
              }
              environmentVariables={
                (values.spec.env ?? null) as Record<string, unknown> | null
              }
              collapsible
              framed={false}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function EndpointDeploymentWizard<T extends FieldValues = FieldValues>({
  form,
  mode = "create",
  activeStep,
  onStepChange,
  modifiedSteps = new Set(),
  errorsByStep,
  modelFields,
  resourceFields,
  runtimeFields,
  advancedFields,
  estimateFields,
  configurationFields,
  reviewChanges = [],
  hasChanges = false,
  reviewContext,
  stepCompletions,
  serverIssue,
  validationAttempted = false,
  submitBlocked,
}: EndpointDeploymentWizardProps<T>) {
  const { t } = useTranslation();
  const [visitedSteps, setVisitedSteps] = useState(() => new Set([0]));

  useEffect(() => {
    setVisitedSteps((visited) => {
      if (visited.has(activeStep)) return visited;
      const next = new Set(visited);
      next.add(activeStep);
      return next;
    });
  }, [activeStep]);

  const capacityMessage =
    submitBlocked && (activeStep === 1 || visitedSteps.has(1))
      ? t("endpoints.wizard.issues.capacityBlocked")
      : null;
  const issues = useMemo(() => {
    const next = endpointWizardIssues(errorsByStep, capacityMessage);
    if (serverIssue) {
      next.push({
        step: serverIssue.step,
        message: serverIssue.message,
        source: "server",
      });
    }
    return next;
  }, [capacityMessage, errorsByStep, serverIssue]);

  const stepFields = [
    modelFields,
    resourceFields,
    runtimeFields,
    advancedFields,
    <ReviewStep
      key="confirm"
      form={form}
      mode={mode}
      onStepChange={onStepChange}
      errorsByStep={errorsByStep}
      issues={issues}
      validationAttempted={validationAttempted}
      reviewContext={reviewContext}
      reviewChanges={reviewChanges}
      hasChanges={hasChanges}
    />,
  ];

  return (
    <div className="space-y-4">
      <nav
        aria-label={t("endpoints.wizard.navigation")}
        className="grid overflow-hidden rounded-lg border bg-[var(--nt-fill-neutral-white)] sm:grid-cols-3 xl:grid-cols-5"
      >
        {STEP_KEYS.map((key, index) => {
          const issueCount = issues.filter(
            (issue) => issue.step === index,
          ).length;
          const hasError = issueCount > 0;
          const active = activeStep === index;
          const modified = mode === "edit" && modifiedSteps.has(index);
          const completion = visitedSteps.has(index)
            ? (stepCompletions[index] ?? "not-started")
            : "not-started";
          const status = hasError
            ? t("endpoints.wizard.step.needsAttention", {
                count: issueCount,
              })
            : modified
              ? t("endpoints.wizard.step.modified")
              : mode === "create" && !active && completion === "complete"
                ? t("endpoints.wizard.step.completed")
                : mode === "create" && completion === "in-progress"
                  ? t("endpoints.wizard.step.inProgress")
                  : active
                    ? t(
                        mode === "edit"
                          ? "endpoints.wizard.step.currentConfiguration"
                          : "endpoints.wizard.step.current",
                      )
                    : t(
                        mode === "edit"
                          ? "endpoints.wizard.step.unchanged"
                          : "endpoints.wizard.step.pending",
                      );
          return (
            <button
              key={key}
              type="button"
              aria-current={active ? "step" : undefined}
              onClick={() => onStepChange(index)}
              className={cn(
                "relative min-h-[72px] min-w-0 break-words border-b px-3 py-3 text-left transition-colors sm:border-r xl:border-b-0 xl:last:border-r-0",
                "focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring",
                active && "bg-primary/5",
                hasError && "bg-destructive/5",
              )}
            >
              <span className="flex items-center gap-2">
                <span
                  data-testid={`endpoint-wizard-step-${index + 1}`}
                  className={cn(
                    "grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs font-semibold tabular-nums",
                    active &&
                      "border-primary bg-primary text-primary-foreground",
                    !active &&
                      hasError &&
                      "border-destructive text-destructive",
                    !active &&
                      !hasError &&
                      modified &&
                      "border-[var(--nt-text-colorful-notice)] text-[var(--nt-text-colorful-notice)]",
                    !active &&
                      !hasError &&
                      mode === "create" &&
                      completion === "complete" &&
                      "border-[var(--nt-text-colorful-positive)] text-[var(--nt-text-colorful-positive)]",
                    !active &&
                      !hasError &&
                      !modified &&
                      completion !== "complete" &&
                      "text-muted-foreground",
                  )}
                >
                  {!active &&
                  !hasError &&
                  mode === "create" &&
                  completion === "complete" ? (
                    <CheckCircle2 aria-hidden="true" className="size-3.5" />
                  ) : (
                    index + 1
                  )}
                </span>
                <span className="min-w-0">
                  <span
                    className={cn(
                      "block whitespace-normal text-sm font-semibold leading-5",
                      active && "text-primary",
                      !active && hasError && "text-destructive",
                      !active &&
                        !hasError &&
                        modified &&
                        "text-[var(--nt-text-colorful-notice)]",
                      !active &&
                        !hasError &&
                        mode === "create" &&
                        completion === "complete" &&
                        "text-[var(--nt-text-colorful-positive)]",
                    )}
                  >
                    {t(key)}
                  </span>
                  <span
                    className={cn(
                      "mt-0.5 block text-[11px] leading-4 text-[var(--nt-text-neutral-quaternary)]",
                      hasError && "text-destructive",
                      !hasError &&
                        modified &&
                        "text-[var(--nt-text-colorful-notice)]",
                      !hasError &&
                        mode === "create" &&
                        completion === "complete" &&
                        "text-[var(--nt-text-colorful-positive)]",
                    )}
                  >
                    {status}
                  </span>
                </span>
              </span>
              {active && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />
              )}
            </button>
          );
        })}
      </nav>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start 2xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-4">
          <div key={activeStep}>
            {activeStep < STEP_KEYS.length - 1 ? (
              <FormSectionStack>{stepFields[activeStep]}</FormSectionStack>
            ) : (
              stepFields[activeStep]
            )}
          </div>
        </div>
        <DeploymentSummary
          form={form}
          estimateFields={estimateFields}
          configurationFields={configurationFields}
        />
      </div>
    </div>
  );
}
