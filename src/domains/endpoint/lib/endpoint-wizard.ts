import type { FieldErrors, FieldPath } from "react-hook-form";
import type { Endpoint } from "@/domains/endpoint/types";
import { getApiErrorCode } from "@/foundation/lib/api-error-code";
import {
  getErrorMessage,
  isDuplicateNameError,
} from "@/foundation/lib/error-message";

/** The wizard's steps, in order. */
export const EndpointStep = {
  model: 0,
  resources: 1,
  runtime: 2,
  advanced: 3,
  confirm: 4,
} as const;

type EndpointStepIndex = (typeof EndpointStep)[keyof typeof EndpointStep];

export const LAST_ENDPOINT_STEP = EndpointStep.confirm;

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
 * particular, spec.model.task is rendered with the engine on the runtime step,
 * so it is listed there and not under the model step's spec.model.* fields.
 */
export const endpointStepValidationPaths = {
  [EndpointStep.model]: [
    "metadata.name",
    "metadata.workspace",
    "spec.replicas.num",
    "spec.model.registry",
    "spec.model.name",
    "spec.model.version",
    "spec.model.file",
    "-model-catalog" as FieldPath<Endpoint>,
  ],
  [EndpointStep.resources]: ["spec.cluster", "spec.resources"],
  [EndpointStep.runtime]: ["spec.engine", "spec.kv_cache", "spec.model.task"],
  [EndpointStep.advanced]: [
    "spec.deployment_options",
    "spec.variables",
    "spec.env",
  ],
  [EndpointStep.confirm]: [],
} as const satisfies Record<EndpointStepIndex, readonly FieldPath<Endpoint>[]>;

const stepPrefixes = Object.entries(endpointStepValidationPaths)
  .flatMap(([step, paths]) =>
    paths.map((prefix: string) => ({ prefix, step: Number(step) })),
  )
  .sort((left, right) => right.prefix.length - left.prefix.length);

/** The step that owns a field: the one listing the longest prefix of it. */
const endpointRootStep = (path: string): number => {
  const owner = stepPrefixes.find(
    ({ prefix }) => path === prefix || path.startsWith(`${prefix}.`),
  );

  // An unexpected form error still belongs somewhere actionable. The model
  // step is the safest fallback because it owns the remaining required inputs.
  return owner?.step ?? EndpointStep.model;
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

const flattenErrors = (errors: FieldErrors) => {
  const flattened: Array<{ path: string; message: string }> = [];
  walkErrors(errors, "", flattened);
  return flattened;
};

export function endpointErrorsByStep(
  errors: FieldErrors,
): EndpointWizardErrors {
  const grouped: EndpointWizardErrors = {};
  for (const error of flattenErrors(errors)) {
    const step = endpointRootStep(error.path);
    grouped[step] = [...(grouped[step] ?? []), error.message];
  }
  return grouped;
}

/** The first field with an error on `step`, to move focus to. */
export function firstEndpointErrorPath(
  errors: FieldErrors,
  step: number,
): string | null {
  return (
    flattenErrors(errors).find((error) => endpointRootStep(error.path) === step)
      ?.path ?? null
  );
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
    [EndpointStep.model]: modelComplete
      ? "complete"
      : modelStarted
        ? "in-progress"
        : "not-started",
    [EndpointStep.resources]: resourceComplete
      ? "complete"
      : resourceStarted
        ? "in-progress"
        : "not-started",
    [EndpointStep.runtime]: runtimeComplete
      ? "complete"
      : runtimeStarted
        ? "in-progress"
        : "not-started",
    // Scheduler, engine args and environment variables are all optional.
    [EndpointStep.advanced]: "complete",
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
  "10216": EndpointStep.resources,
  "10219": EndpointStep.resources,
  "10222": EndpointStep.resources,
  "10227": EndpointStep.resources,
  "10230": EndpointStep.resources,
  "10232": EndpointStep.runtime,
  "10233": EndpointStep.resources,
  "10229": EndpointStep.model,
  "10234": EndpointStep.model,
  "21101": EndpointStep.runtime,
  "21102": EndpointStep.runtime,
  "21103": EndpointStep.runtime,
  "21104": EndpointStep.runtime,
  "21105": EndpointStep.runtime,
  "21106": EndpointStep.runtime,
  "21107": EndpointStep.runtime,
  "21108": EndpointStep.advanced,
  "22023": EndpointStep.runtime,
  INVALID_CACHE_CONFIGURATION: EndpointStep.runtime,
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
 * Maps a failed save to an actionable step: an explicit field path or a
 * duplicate name to the field's step, a stable server code to its step, and
 * anything else to the confirm step.
 */
export function endpointServerIssue(
  error: unknown,
  fallbackMessage: string,
  translateError?: (error: unknown) => string | undefined,
): EndpointServerIssue {
  const path =
    explicitServerPath(error) ??
    (isDuplicateNameError(error) ? "metadata.name" : undefined);
  const code = getApiErrorCode(error);
  const step =
    path != null
      ? endpointRootStep(path)
      : ((code ? serverCodeSteps[code] : undefined) ?? LAST_ENDPOINT_STEP);

  return {
    step,
    path,
    message: translateError?.(error) ?? getErrorMessage(error, fallbackMessage),
  };
}

/** One source of truth for the stepper and summary. Field validation keeps its
 * owning step; a capacity block is the resource step's issue; a server issue
 * keeps the step it was mapped to. */
export function endpointWizardIssues(
  errorsByStep: EndpointWizardErrors,
  capacityMessage?: string | null,
  serverIssue?: EndpointServerIssue | null,
): EndpointDeploymentIssue[] {
  const issues: EndpointDeploymentIssue[] = [];

  for (const [step, messages] of Object.entries(errorsByStep)) {
    for (const message of messages) {
      issues.push({ step: Number(step), message, source: "validation" });
    }
  }
  if (capacityMessage) {
    issues.push({
      step: EndpointStep.resources,
      message: capacityMessage,
      source: "capacity",
    });
  }
  if (serverIssue) {
    issues.push({
      step: serverIssue.step,
      message: serverIssue.message,
      source: "server",
    });
  }

  return issues;
}

export type EndpointStepStatus =
  | "attention"
  | "modified"
  | "completed"
  | "in-progress"
  | "current"
  | "pending";

/**
 * What the stepper says about one step. Issues win, then an edit's changes;
 * completion is only tracked while creating.
 */
export function endpointStepStatus({
  mode,
  active,
  issueCount,
  modified,
  completion,
}: {
  mode: "create" | "edit";
  active: boolean;
  issueCount: number;
  modified: boolean;
  completion: EndpointStepCompletion;
}): EndpointStepStatus {
  if (issueCount > 0) return "attention";
  if (modified) return "modified";
  if (mode === "create" && !active && completion === "complete") {
    return "completed";
  }
  if (mode === "create" && completion === "in-progress") return "in-progress";
  return active ? "current" : "pending";
}
