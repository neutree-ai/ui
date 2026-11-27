import type { UseFormReturn } from "react-hook-form";
import { normalizeEndpointResourcesForForm } from "@/domains/endpoint/lib/endpoint-form-helpers";
import {
  getRoundedVgpuMemoryGiBValue,
  normalizeVgpuMemoryGiBInput,
} from "@/domains/endpoint/lib/vgpu";
import type { EndpointSpec, ResourceSpec } from "@/domains/endpoint/types";
import { matchesAcceleratorName } from "@/foundation/recipe/vram";

type Accelerator = ResourceSpec["accelerator"];
type Virtualization = NonNullable<Accelerator>["virtualization"] | undefined;
type EndpointForm = Pick<
  UseFormReturn,
  "setValue" | "getValues" | "getFieldState" | "clearErrors"
>;
/** Writes an object's leaves one path at a time, so mounted fields hear it. */
type SetLeafValues = (basePath: string, obj: Record<string, unknown>) => void;

const RESOURCES = "spec.resources";
const ACCELERATOR = "spec.resources.accelerator";
const VIRTUALIZATION = "spec.resources.accelerator.virtualization";

/** Options for a value the user typed or picked. */
export const userSetValueOptions = {
  shouldDirty: true,
  shouldTouch: true,
  shouldValidate: true,
} as const;

/**
 * Options for a value derived from another field: it may fill a field that
 * already shows an error, but must not surface a new required error merely
 * because the field appeared.
 */
export const derivedValueOptions = (hasError: boolean) => ({
  shouldDirty: true,
  shouldValidate: hasError,
});

/** Whether the endpoint's KV cache is served by ZCache. */
export const usesZCache = (cache: EndpointSpec["kv_cache"] | undefined) =>
  cache?.provider === "zcache";

const setDerived = (
  form: EndpointForm,
  path: typeof ACCELERATOR | typeof VIRTUALIZATION,
  value: Accelerator | Virtualization,
) =>
  form.setValue(
    path,
    value as never,
    derivedValueOptions(Boolean(form.getFieldState(path).error)),
  );

/** Writes the virtualization as a change derived from the cluster or capacity. */
export const setDerivedVirtualization = (
  form: EndpointForm,
  value: Virtualization,
) => setDerived(form, VIRTUALIZATION, value);

/** Writes the virtualization the user typed. */
export const setUserVirtualization = (
  form: EndpointForm,
  value: Virtualization,
) => form.setValue(VIRTUALIZATION, value, userSetValueOptions);

/** Full cards carry no virtualization: drops it and its field errors. */
export function clearVirtualization(form: EndpointForm) {
  form.setValue(VIRTUALIZATION, undefined, {
    shouldDirty: true,
    shouldValidate: false,
  });
  form.clearErrors(`${VIRTUALIZATION}.memory_mib`);
  form.clearErrors(`${VIRTUALIZATION}.core_percent`);
}

/**
 * The virtualization without the resources the cluster's supported_resources
 * omits, which admission would reject; the same object when nothing is dropped.
 */
export function supportedVirtualization(
  virtualization: Virtualization,
  supported: { core: boolean; memory: boolean },
): Virtualization {
  if (!virtualization) return virtualization;
  const next = { ...virtualization };
  let changed = false;
  for (const [key, ok] of [
    ["core_percent", supported.core],
    ["memory_mib", supported.memory],
  ] as const) {
    const value = (virtualization as Record<string, unknown>)[key];
    if (!ok && value !== undefined && value !== null && value !== "") {
      delete next[key];
      changed = true;
    }
  }
  if (!changed) return virtualization;
  return Object.keys(next).length > 0 ? next : undefined;
}

/**
 * The virtualization with its memory aligned to the GiB the input shows and
 * the boundary allows; the same object when it already is.
 */
export function alignedVgpuMemory(
  virtualization: Virtualization,
  memoryTotalMiB: number | null | undefined,
  boundaryMiB: number | null | undefined,
): Virtualization {
  const currentMiB = Number(virtualization?.memory_mib);
  if (
    !Number.isFinite(currentMiB) ||
    currentMiB <= 0 ||
    boundaryMiB === null ||
    boundaryMiB === undefined
  ) {
    return virtualization;
  }
  const displayedGiB = getRoundedVgpuMemoryGiBValue(currentMiB);
  if (displayedGiB === null) return virtualization;
  const alignedMiB = normalizeVgpuMemoryGiBInput(
    displayedGiB,
    memoryTotalMiB,
    boundaryMiB,
  );
  if (alignedMiB === undefined || alignedMiB === currentMiB) {
    return virtualization;
  }
  return { ...(virtualization ?? {}), memory_mib: alignedMiB };
}

/**
 * The virtualization for a typed single-card memory in GiB (stored as MiB),
 * keeping the core limit; a cleared or non-positive value keeps only the core
 * limit. Null when the input is not a number to act on.
 */
export function virtualizationForMemoryInput(
  rawValue: string,
  virtualization: Virtualization,
  memoryTotalMiB: number | null | undefined,
  boundaryMiB: number | null | undefined,
): { value: Virtualization } | null {
  const corePercent = Number(virtualization?.core_percent);
  const coreOnly =
    Number.isFinite(corePercent) && corePercent > 0
      ? { core_percent: corePercent }
      : undefined;
  if (!rawValue.trim()) return { value: coreOnly };
  const memoryGiB = Number.parseFloat(rawValue);
  if (Number.isNaN(memoryGiB)) return null;
  if (memoryGiB <= 0) return { value: coreOnly };
  const memoryMiB = normalizeVgpuMemoryGiBInput(
    memoryGiB,
    memoryTotalMiB,
    boundaryMiB,
  );
  if (memoryMiB === undefined) return null;
  return { value: { ...(coreOnly ?? {}), memory_mib: memoryMiB } };
}

/**
 * The virtualization for a typed core limit; a cleared or zero limit drops
 * it. Null when the input is not a number.
 */
export function virtualizationForCoreInput(
  rawValue: string,
  virtualization: Virtualization,
): { value: Virtualization } | null {
  const corePercent = rawValue.trim() ? Number.parseFloat(rawValue) : 0;
  if (Number.isNaN(corePercent)) return null;
  const next: NonNullable<Virtualization> = { ...(virtualization ?? {}) };
  if (corePercent > 0) next.core_percent = corePercent;
  else delete next.core_percent;
  return { value: Object.keys(next).length > 0 ? next : undefined };
}

/**
 * The accelerator for a picked option; on a vGPU cluster it carries the
 * current virtualization (an empty one when there is none).
 */
export const acceleratorForOption = (
  option: { type: string; product: string },
  virtualization: Virtualization,
  vgpuEnabled: boolean,
): NonNullable<Accelerator> => ({
  type: option.type,
  product: option.product,
  ...(vgpuEnabled ? { virtualization: virtualization || {} } : {}),
});

/**
 * Reconciles the accelerator with the cluster's inventory: keeps one that is
 * offered and compatible with the engine, clears one that is no longer valid,
 * and leaves an unset accelerator for the user to choose.
 */
export function reconcileAccelerator(
  form: EndpointForm,
  options: { type: string; product: string }[],
  engineAcceleratorTypes: string[],
) {
  const current = form.getValues(ACCELERATOR);
  const compatible = options.filter(
    (option) =>
      engineAcceleratorTypes.length === 0 ||
      engineAcceleratorTypes.includes(option.type),
  );
  const available = Boolean(
    current?.type &&
      current.product &&
      compatible.some(
        (option) =>
          option.type === current.type && option.product === current.product,
      ),
  );
  if (available) return;
  if (!current) return;
  setDerived(form, ACCELERATOR, null);
  form.clearErrors(`${VIRTUALIZATION}.memory_mib`);
  form.clearErrors(`${VIRTUALIZATION}.core_percent`);
}

const acceleratorProductsMatch = (left: string, right: string) =>
  left === right ||
  matchesAcceleratorName(left, [right]) ||
  matchesAcceleratorName(right, [left]);

/**
 * Whether a manually selected accelerator differs from the reference hardware
 * carried by the Model Catalog. Missing catalog or selection data is not a
 * mismatch and must not produce an unverified warning.
 */
export function catalogAcceleratorMismatch(
  selected: Accelerator | undefined,
  reference: Accelerator | undefined,
): boolean {
  if (!selected?.type && !selected?.product) return false;
  if (!reference?.type && !reference?.product) return false;

  const selectedProduct = selected.product;
  const referenceProduct = reference.product;
  const typeMismatch =
    Boolean(selected.type) &&
    Boolean(reference.type) &&
    selected.type !== reference.type;
  const productMismatch = Boolean(
    selectedProduct &&
      referenceProduct &&
      !acceleratorProductsMatch(selectedProduct, referenceProduct),
  );

  return typeMismatch || productMismatch;
}

/**
 * Writes resources normalized for the form, silently, unless the form
 * already holds exactly them.
 */
export function writeFormResources(
  form: EndpointForm,
  next: ResourceSpec,
  setLeafValues: SetLeafValues,
  current: unknown = form.getValues(RESOURCES),
) {
  if (JSON.stringify(current) === JSON.stringify(next)) return;
  form.setValue(RESOURCES, next, { shouldDirty: false, shouldValidate: false });
  setLeafValues(RESOURCES, next as unknown as Record<string, unknown>);
}

/** Rewrites the form's own resources in their normalized form-shape. */
export function renormalizeFormResources(
  form: EndpointForm,
  watched: ResourceSpec | null | undefined,
  setLeafValues: SetLeafValues,
) {
  const current = form.getValues(RESOURCES) ?? watched;
  const next = normalizeEndpointResourcesForForm(current);
  if (next) writeFormResources(form, next, setLeafValues, current);
}
