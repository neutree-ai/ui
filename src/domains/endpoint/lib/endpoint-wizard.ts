import type { FieldErrors, FieldPath } from "react-hook-form";
import type { Endpoint } from "@/domains/endpoint/types";

export type EndpointWizardErrors = Record<number, string[]>;

export type EndpointDeploymentIssue = {
  step: number;
  message: string;
  source: "validation" | "capacity" | "server";
};

export type EndpointStepCompletion = "not-started" | "in-progress" | "complete";

export type EndpointStepCompletions = Record<number, EndpointStepCompletion>;

export type EndpointServerIssue = {
  step: number;
  path?: string;
  message: string;
};

/**
 * Field ownership for step-by-step validation. Keep this aligned with the
 * controls mounted by each wizard step, not with the API's nesting. In
 * particular, spec.model.task is rendered with the engine on the runtime step.
 */
export const endpointStepValidationPaths = {
  0: [
    "metadata.name",
    "metadata.workspace",
    "spec.replicas.num",
    "spec.model.registry",
    "spec.model.name",
    "spec.model.version",
    "spec.model.file",
    "-model-catalog" as FieldPath<Endpoint>,
  ],
  1: ["spec.cluster", "spec.resources"],
  2: ["spec.engine", "spec.kv_cache", "spec.model.task"],
  3: ["spec.deployment_options", "spec.variables", "spec.env"],
  4: [],
} as const satisfies Record<number, readonly FieldPath<Endpoint>[]>;

const endpointRootStep = (path: string): number => {
  if (path === "spec.model.task") {
    return 2;
  }
  if (
    path.startsWith("metadata.") ||
    path.startsWith("spec.model.") ||
    path.startsWith("spec.replicas.") ||
    path === "-model-catalog"
  ) {
    return 0;
  }
  if (path.startsWith("spec.cluster") || path.startsWith("spec.resources.")) {
    return 1;
  }
  if (path.startsWith("spec.engine.") || path.startsWith("spec.kv_cache.")) {
    return 2;
  }
  if (
    path.startsWith("spec.deployment_options.") ||
    path.startsWith("spec.variables.") ||
    path.startsWith("spec.env.")
  ) {
    return 3;
  }

  // An unexpected form error still belongs somewhere actionable. The model
  // step is the safest fallback because it owns the remaining required inputs.
  return 0;
};

const walkErrors = (
  value: unknown,
  prefix: string,
  output: Array<{ path: string; message: string }>,
) => {
  if (!value || typeof value !== "object") return;

  const record = value as Record<string, unknown>;
  const message = record.message;
  if (typeof message === "string" && message) {
    output.push({ path: prefix, message });
    return;
  }

  for (const [key, child] of Object.entries(record)) {
    if (key === "ref" || key === "type") continue;
    const next = prefix ? `${prefix}.${key}` : key;
    walkErrors(child, next, output);
  }
};

export function endpointErrorsByStep(
  errors: FieldErrors,
): EndpointWizardErrors {
  const flattened: Array<{ path: string; message: string }> = [];
  walkErrors(errors, "", flattened);

  const grouped: EndpointWizardErrors = {};
  for (const error of flattened) {
    const step = endpointRootStep(error.path);
    grouped[step] = [...(grouped[step] ?? []), error.message];
  }
  return grouped;
}

export function endpointDirtySteps(dirtyFields: unknown): ReadonlySet<number> {
  const steps = new Set<number>();

  const walk = (value: unknown, prefix: string) => {
    if (value === true) {
      steps.add(endpointRootStep(prefix));
      return;
    }
    if (!value || typeof value !== "object") return;

    for (const [key, child] of Object.entries(value)) {
      walk(child, prefix ? `${prefix}.${key}` : key);
    }
  };

  walk(dirtyFields, "");
  return steps;
}

const hasText = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0;

/**
 * Distinguishes an untouched optional step from one whose required facts are
 * complete. Validation errors still take precedence in the wizard.
 */
export function endpointStepCompletions(
  values: Endpoint,
  requiresModel: boolean,
): EndpointStepCompletions {
  const metadata = values.metadata;
  const spec = values.spec;
  const model = spec.model;
  const resources = spec.resources;

  const modelStarted =
    hasText(metadata?.name) ||
    Boolean(model?.registry || model?.name || model?.version || model?.file) ||
    Number(spec.replicas?.num ?? 1) !== 1;
  const modelComplete =
    hasText(metadata?.name) &&
    hasText(metadata?.workspace) &&
    Number(spec.replicas?.num ?? 0) >= 1 &&
    (!requiresModel || (hasText(model?.registry) && hasText(model?.name)));

  const resourceStarted = Boolean(
    spec.cluster ||
      resources?.accelerator?.type ||
      Number(resources?.cpu ?? 0) > 0 ||
      Number(resources?.memory ?? 0) > 0 ||
      Number(resources?.gpu ?? 0) > 0,
  );
  const resourceComplete = Boolean(
    spec.cluster &&
      resources?.accelerator?.type &&
      resources?.accelerator?.product,
  );

  const runtimeStarted = Boolean(
    spec.engine?.engine || spec.engine?.version || model?.task || spec.kv_cache,
  );
  const runtimeComplete = Boolean(
    spec.engine?.engine &&
      spec.engine?.version &&
      (!requiresModel || model?.task),
  );

  return {
    0: modelComplete
      ? "complete"
      : modelStarted
        ? "in-progress"
        : "not-started",
    1: resourceComplete
      ? "complete"
      : resourceStarted
        ? "in-progress"
        : "not-started",
    2: runtimeComplete
      ? "complete"
      : runtimeStarted
        ? "in-progress"
        : "not-started",
    // Scheduler, engine args and environment variables are all optional.
    3: "complete",
  };
}

export function firstEndpointErrorStep(errors: FieldErrors): number | null {
  const grouped = endpointErrorsByStep(errors);
  const steps = Object.keys(grouped)
    .map(Number)
    .filter((step) => grouped[step]?.length)
    .sort((a, b) => a - b);
  return steps[0] ?? null;
}

const serverCodeSteps: Record<string, number> = {
  "10216": 1,
  "10219": 1,
  "10222": 1,
  "10227": 1,
  "10230": 1,
  "10232": 2,
  "10233": 1,
  "10229": 0,
  "10234": 0,
  "22023": 2,
};

const explicitServerPath = (error: unknown): string | null => {
  if (!error || typeof error !== "object") return null;
  const value = error as {
    path?: unknown;
    field?: unknown;
    fieldPath?: unknown;
  };
  for (const candidate of [value.path, value.field, value.fieldPath]) {
    if (
      typeof candidate === "string" &&
      (candidate.startsWith("metadata.") || candidate.startsWith("spec."))
    ) {
      return candidate;
    }
  }
  return null;
};

/**
 * Maps stable server error codes to an actionable step. Message/hint text is
 * only displayed; it is never parsed to choose a field.
 */
export function endpointServerIssue(
  error: unknown,
  fallbackMessage: string,
): EndpointServerIssue {
  const value =
    error && typeof error === "object"
      ? (error as {
          code?: unknown;
          statusCode?: unknown;
          message?: unknown;
        })
      : null;
  const code =
    typeof value?.code === "string" ? value.code : String(value?.code ?? "");
  const path =
    explicitServerPath(error) ??
    (code === "23505" || value?.statusCode === 409
      ? "metadata.name"
      : undefined);
  const step =
    path != null ? endpointRootStep(path) : (serverCodeSteps[code] ?? 4);
  const message =
    typeof value?.message === "string" && value.message.trim()
      ? value.message.trim()
      : fallbackMessage;

  return { step, path, message };
}

/** One source of truth for the stepper and summary. Field validation keeps its
 * owning step; a capacity block is the resource step's issue. */
export function endpointWizardIssues(
  errorsByStep: EndpointWizardErrors,
  capacityMessage?: string | null,
): EndpointDeploymentIssue[] {
  const issues: EndpointDeploymentIssue[] = [];

  for (const [step, messages] of Object.entries(errorsByStep)) {
    for (const message of messages) {
      issues.push({ step: Number(step), message, source: "validation" });
    }
  }
  if (capacityMessage) {
    issues.push({ step: 1, message: capacityMessage, source: "capacity" });
  }

  return issues;
}
