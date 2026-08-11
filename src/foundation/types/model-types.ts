import type { ModelInfo } from "@/foundation/types/serving-types";

/**
 * How a model info field's value was established, as reported per field in
 * ModelInfo.field_sources:
 *  - "auto"    read straight out of the checkpoint
 *  - "derived" computed from other checkpoint values by a documented convention
 *  - "manual"  typed in by a user
 *
 * A field that carries a value but names no source has provenance the server
 * did not state; render the value, not a guess about where it came from.
 */
export type ModelFieldSource = "auto" | "derived" | "manual";

const KNOWN_FIELD_SOURCES: ModelFieldSource[] = ["auto", "derived", "manual"];

/** Reads the provenance of one field, or null when the server stated none. */
export function modelFieldSource(
  info: ModelInfo | null | undefined,
  field: string,
): ModelFieldSource | null {
  const source = info?.field_sources?.[field];

  return KNOWN_FIELD_SOURCES.find((known) => known === source) ?? null;
}

/** Whether the server explicitly reported a field as looked for and not found. */
export function isModelFieldMissing(
  info: ModelInfo | null | undefined,
  field: string,
): boolean {
  return Boolean(info?.missing_fields?.includes(field));
}

/** One version of a model, as the model registry API reports it. */
export type RegistryModelVersion = {
  name: string;
  creation_time: string;
  size?: string;
  module?: string;
  /** Labels from the model's own descriptor. */
  labels?: Record<string, string> | null;
  description?: string;
  /**
   * Display name a user gave this version. It never reaches spec.model.name, so
   * it is not the name the model is served under.
   */
  alias?: string;
  /**
   * What the checkpoint states about itself, plus any hand-filled values. Only
   * the detail read path fills this in — listings leave it absent rather than
   * open every checkpoint.
   */
  info?: ModelInfo | null;
};

export type RegistryModel = {
  name: string;
  versions: RegistryModelVersion[];
};

/**
 * An object standing in the way of deleting a model, as returned in the
 * `references` array of a rejected delete.
 */
export type ModelReference = {
  kind: string;
  name: string;
  workspace: string;
  /** The referring endpoint's phase, when the reference is an endpoint. */
  phase?: string;
  /** The recipe variant key, when the reference is a model catalog variant. */
  variant?: string;
};

/**
 * The object already holding an alias, as returned in the body of a 409. Kind is
 * "Model" for another model version, or "ModelName" when the alias would shadow
 * a physical model name — the latter has no version.
 */
export type ModelAliasConflict = {
  kind: string;
  name: string;
  version?: string;
};
