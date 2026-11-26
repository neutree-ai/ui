import type { EndpointEngineSpec, ModelSpec } from "../types";

/** A named model as shown: `label` is the name with its version, if any. */
type EndpointModelRef = {
  registry: string;
  name: string;
  version: string;
  label: string;
};

/**
 * The model an endpoint serves, or null when it names none. Tested on the name,
 * not on the block: an engine that brings its own workload keeps `spec.model`
 * with only the task the gateway routes on.
 */
export function endpointModelRef(
  model: ModelSpec | null | undefined,
): EndpointModelRef | null {
  if (!model?.name) return null;
  return {
    registry: model.registry,
    name: model.name,
    version: model.version,
    label: model.version ? `${model.name}:${model.version}` : model.name,
  };
}

/** An engine reference as shown: `engine:version`, the name alone without a version, empty without a name. */
export function engineRefLabel(
  engine: Partial<EndpointEngineSpec> | null | undefined,
): string {
  if (!engine?.engine) return "";
  return engine.version ? `${engine.engine}:${engine.version}` : engine.engine;
}

/** The optional model fields start open when the model already sets either. */
export const hasOptionalModelFields = (
  model: Pick<ModelSpec, "version" | "file">,
) => Boolean(model.version || model.file);
