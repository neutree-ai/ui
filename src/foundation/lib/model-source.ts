/**
 * A model's **source**: where the model runs and who runs it. It is shown as a
 * badge wherever a model is listed and is the grouping of the API-key model
 * picker, because cost follows the source.
 *
 * - **Internal endpoints store nothing.** A model the platform serves is always
 *   {@link SELF_HOSTED_MODEL_SOURCE}.
 * - **External endpoints** store one value per client-facing model name in
 *   `spec.model_sources`. Per model, not per endpoint: one endpoint fronts
 *   models of different origin. A model with no stored value falls back to what
 *   its routing implies, see {@link deriveExternalModelSource}.
 *
 * The vocabulary is open. The presets are suggestions, and any other string is
 * a valid source that renders as itself.
 */

/** A source value. A bare `string`, because the vocabulary is open. */
export type ModelSource = string;

/** A map of client-facing model name -> source, as stored on an endpoint spec. */
export type ModelSourceMap = Record<string, string> | null | undefined;

/** The source of every model the platform serves itself. */
export const SELF_HOSTED_MODEL_SOURCE = "self-hosted";

/**
 * The presets, in the order they are offered, sorted and grouped. Each has a
 * string under `modelSource.values` in the locale files.
 */
export const MODEL_SOURCE_PRESETS: readonly ModelSource[] = [
  SELF_HOSTED_MODEL_SOURCE,
  "private-access",
  "third-party-public",
  "hybrid",
];

/** Read a value out of `spec.model_sources`. Blank means no source. */
export function parseStoredModelSource(raw: unknown): ModelSource | undefined {
  const source = String(raw ?? "").trim();
  return source === "" ? undefined : source;
}

/**
 * The source known from the endpoint kind alone, for when the endpoint itself
 * is not at hand. Exact for an internal endpoint; an external one needs its
 * spec, see {@link resolveExternalModelSource}.
 */
export function modelSourceOfEndpointKind(
  kind: "internal" | "external",
): ModelSource | undefined {
  return kind === "internal" ? SELF_HOSTED_MODEL_SOURCE : undefined;
}

type SourceUpstream = {
  name?: string | null;
  endpoint_ref?: string | null;
  model_mapping?: Record<string, string> | null;
};

type SourceRoute = {
  model?: string | null;
  targets?: { upstream?: string | null }[] | null;
};

/**
 * The parts of an external endpoint spec a model's source depends on. The bare
 * shape rather than the domain type, so this stays in the foundation layer.
 */
export type ExternalModelSourceSpec =
  | {
      model_sources?: ModelSourceMap;
      upstreams?: SourceUpstream[] | null;
      model_routes?: SourceRoute[] | null;
    }
  | null
  | undefined;

/**
 * Self-hosted when every upstream serving a model points at an internal
 * endpoint. A model that also reaches anything else has no implied source.
 */
function impliedModelSource(
  serving: (SourceUpstream | undefined)[],
): ModelSource | undefined {
  const selfHosted =
    serving.length > 0 &&
    serving.every((upstream) => String(upstream?.endpoint_ref ?? "").trim());
  return selfHosted ? SELF_HOSTED_MODEL_SOURCE : undefined;
}

/** The source the targets of one route imply. */
export function deriveRouteModelSource(
  upstreams: SourceUpstream[] | null | undefined,
  route: SourceRoute,
): ModelSource | undefined {
  return impliedModelSource(
    (route.targets ?? []).map((target) =>
      (upstreams ?? []).find((upstream) => upstream?.name === target?.upstream),
    ),
  );
}

/**
 * The source a model's routing implies when nothing is stored for it. Routes
 * supersede the upstreams' mappings when the endpoint has any, the same
 * precedence that decides which models it exposes.
 */
export function deriveExternalModelSource(
  spec: ExternalModelSourceSpec,
  model: string,
): ModelSource | undefined {
  const upstreams = spec?.upstreams ?? [];
  if (spec?.model_routes?.length) {
    const route = spec.model_routes.find((item) => item?.model === model);
    return route ? deriveRouteModelSource(upstreams, route) : undefined;
  }
  return impliedModelSource(
    upstreams.filter((upstream) => model in (upstream?.model_mapping ?? {})),
  );
}

/**
 * The source to show for one model of an external endpoint: the stored value,
 * else the derived one, else `undefined`, which renders as "unspecified".
 */
export function resolveExternalModelSource(
  spec: ExternalModelSourceSpec,
  model: string,
): ModelSource | undefined {
  return (
    parseStoredModelSource(spec?.model_sources?.[model]) ??
    deriveExternalModelSource(spec, model)
  );
}

/**
 * Sort key for a source: presets in declared order, then other values, then
 * "unspecified" last. Callers break ties between other values alphabetically.
 */
export function modelSourceRank(source: ModelSource | undefined): number {
  if (!source) return MODEL_SOURCE_PRESETS.length + 1;
  const index = MODEL_SOURCE_PRESETS.indexOf(source);
  return index === -1 ? MODEL_SOURCE_PRESETS.length : index;
}

/**
 * The translation key for a source, for `t(key, { defaultValue: source })`.
 * The `defaultValue` is what makes a value outside the presets render as
 * itself.
 */
export function modelSourceTranslationKey(source: ModelSource): string {
  return `modelSource.values.${source}`;
}

/**
 * The sources to offer for a model of an external endpoint: the presets plus
 * every other value in use, in preset-then-alphabetical order. Offering the
 * values in use is what keeps a free-text field from fragmenting into near
 * duplicates.
 *
 * A value counts as in use only for a model the endpoint still serves: an
 * entry outlives its model until the endpoint is next saved.
 */
export function modelSourceSuggestions(
  usage: Iterable<{
    modelSources: ModelSourceMap;
    /** Client-facing names the endpoint currently serves. */
    models: Iterable<string>;
  }>,
): ModelSource[] {
  const sources = new Set<ModelSource>(MODEL_SOURCE_PRESETS);

  for (const { modelSources, models } of usage) {
    for (const model of models) {
      const source = parseStoredModelSource(modelSources?.[model]);
      if (source) sources.add(source);
    }
  }

  return [...sources].sort(
    (a, b) => modelSourceRank(a) - modelSourceRank(b) || a.localeCompare(b),
  );
}
