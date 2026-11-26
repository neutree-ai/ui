import type { UseFormReturn } from "react-hook-form";
import {
  derivedValueOptions,
  userSetValueOptions,
} from "@/domains/endpoint/lib/endpoint-form-resources";
import type {
  Endpoint,
  EndpointModelCatalogRef,
  EndpointModelRegistryRef,
  ModelSpec,
} from "@/domains/endpoint/types";
import { newestVersion } from "@/foundation/role/version-order";

type EndpointForm = Pick<
  UseFormReturn,
  "setValue" | "getValues" | "getFieldState"
>;

/** The model fields a deployment names, each "" while unset. */
export type ModelIdentity = Pick<
  ModelSpec,
  "registry" | "name" | "version" | "file" | "task"
>;

const MODEL_OVERRIDE_KEYS = [
  "registry",
  "name",
  "version",
  "file",
] as const satisfies ReadonlyArray<Exclude<keyof ModelIdentity, "task">>;

export const modelIdentity = (
  model: Partial<ModelIdentity> | null | undefined,
): ModelIdentity => ({
  registry: model?.registry ?? "",
  name: model?.name ?? "",
  version: model?.version ?? "",
  file: model?.file ?? "",
  task: model?.task ?? "",
});

/** How many of registry, name, version and file differ between two models. */
export const countModelChanges = (
  current: ModelIdentity,
  derived: ModelIdentity,
) => MODEL_OVERRIDE_KEYS.filter((key) => current[key] !== derived[key]).length;

/** The registry with this name in the listing. */
export const findRegistry = (
  registries: EndpointModelRegistryRef[] | undefined,
  name: string,
) => registries?.find((registry) => registry.metadata.name === name);

/** The registry names in the listing, or null while it has not arrived. */
export const registryNames = (
  registries: EndpointModelRegistryRef[] | undefined,
) => (registries ? registries.map((registry) => registry.metadata.name) : null);

/** The model names on a listing page, or null while there is no answer. */
export const modelNames = (page: { models: { name: string }[] } | null) =>
  page ? page.models.map((model) => model.name) : null;

/**
 * Picks a registry: the version, file and checkpoint info belong to the
 * previous one. Returns the model name the form held, "" when none.
 */
export function pickModelRegistry(form: EndpointForm, registry: string) {
  const previousModel = form.getValues("spec.model.name") ?? "";
  form.setValue("spec.model.registry", registry, userSetValueOptions);
  form.setValue("spec.model.version", "", userSetValueOptions);
  form.setValue("spec.model.file", "", userSetValueOptions);
  form.setValue("spec.model.info", null);
  return previousModel;
}

/** Picks a model: the version, file and checkpoint info belong to the previous one. */
export function pickModelName(form: EndpointForm, name: string) {
  form.setValue("spec.model.name", name, userSetValueOptions);
  form.setValue("spec.model.version", "", userSetValueOptions);
  form.setValue("spec.model.file", "", userSetValueOptions);
  form.setValue("spec.model.info", null);
}

/** Clears the model name when the registry's answer does not contain it. */
export function dropMissingModel(
  form: EndpointForm,
  names: string[],
  model: string,
) {
  if (names.includes(model)) return false;
  form.setValue("spec.model.name", "", userSetValueOptions);
  return true;
}

/** Fills the model fields from a deploy-from-registry link; the info is read afresh. */
export function applyRegistryModelPreselection(
  form: EndpointForm,
  preselection: { registry: string; model: string; version?: string },
) {
  form.setValue("spec.model.registry", preselection.registry);
  form.setValue("spec.model.name", preselection.model);
  if (preselection.version) {
    form.setValue("spec.model.version", preselection.version);
  }
  form.setValue("spec.model.info", null);
}

/** The task an engine starts with: text generation when it serves that, else its first task. */
const defaultEngineTask = (tasks: string[]) =>
  tasks.includes("text-generation") ? "text-generation" : (tasks[0] ?? "");

/** The engine reference (at its newest version) and task for a picked engine. */
export function engineChoice<E>(
  engine: E,
  versions: { version: string }[],
  tasks: string[],
) {
  return {
    engine: { engine, version: newestVersion(versions)?.version ?? "" },
    task: defaultEngineTask(tasks),
  };
}

/**
 * A new endpoint starts on vLLM at its newest version, unless an engine is
 * already set; the task is set only when none is.
 */
export function applyDefaultEngine(
  form: EndpointForm,
  engineNames: string[],
  engineVersions: Record<string, { version: string }[]>,
  engineTasks: Record<string, string[]>,
) {
  if (form.getValues("spec.engine.engine") || !engineNames.includes("vllm")) {
    return;
  }
  const version = newestVersion(engineVersions.vllm ?? []);
  if (!version) return;
  const task = defaultEngineTask(engineTasks.vllm ?? []);
  form.setValue("spec.engine", { engine: "vllm", version: version.version });
  if (!form.getValues("spec.model.task") && task) {
    form.setValue("spec.model.task", task);
  }
}

/** Moves the task to the engine version's default when that version does not serve it. */
export function alignTaskWithEngine(form: EndpointForm, tasks: string[]) {
  if (tasks.length === 0) return;
  if (tasks.includes(form.getValues("spec.model.task"))) return;
  form.setValue(
    "spec.model.task",
    defaultEngineTask(tasks),
    derivedValueOptions(Boolean(form.getFieldState("spec.model.task").error)),
  );
}

/** Whether the deployment names anything worth previewing yet. */
export const hasDeploymentPreview = (spec: Endpoint["spec"]) =>
  Boolean(
    spec.model?.name || spec.engine?.engine || spec.cluster || spec.resources,
  );

/**
 * The chosen catalog variant's VRAM floor and model metadata, falling back
 * to the default variant.
 */
export function catalogVariantEstimate(
  catalog: EndpointModelCatalogRef | undefined,
  variant: string,
) {
  const active =
    catalog?.spec.variants?.[variant] ?? catalog?.spec.variants?.default;
  return {
    vramGb: active?.vram_minimum_gb ?? null,
    modelInfo: active?.model?.info ?? null,
  };
}
