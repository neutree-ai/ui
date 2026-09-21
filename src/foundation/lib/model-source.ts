/**
 * A model's **source label** — where the model comes from, as an operator
 * would describe it: something we run ourselves, something another team inside
 * the company shares with us, a metered public API, a partner's deployment.
 *
 * ## Why it exists
 *
 * Cost follows the source. A self-hosted model's cost is already sunk; a
 * third-party public one bills per token. Whoever is picking `allowed_models`
 * for an API key needs to see that distinction at the moment they pick, which
 * is why this replaces — rather than joins — the old Internal/External badge on
 * the list, the detail page and the model picker.
 *
 * ## Where the value comes from
 *
 * - **External endpoints** store it in `spec.model_sources`, a map keyed by the
 *   client-facing model name. Per MODEL, not per endpoint: one endpoint
 *   routinely fronts models of different origin, and a model may even have
 *   routing targets on several upstreams, so neither the endpoint nor the
 *   upstream resolves to one source. A value is a free string, which is what
 *   makes the enum extensible without a migration.
 * - **Internal endpoints store nothing.** Their source is *derived*: an
 *   endpoint the platform runs is `self-hosted`, always, and asking an admin to
 *   re-type that would be a field with one legal answer.
 *
 * That derivation is also a correctness guarantee, not just a convenience. An
 * API key's `allowed_models` entry is a `(model, type, endpoint_name)` triple,
 * and the same model name may be served by both an internal and an external
 * endpoint. Once the Internal/External badge is gone, the source label is what
 * tells those two rows apart in the picker — which only works while
 * `self-hosted` maps one-to-one onto internal endpoints. Hence
 * {@link EXTERNAL_MODEL_SOURCES}: `self-hosted` is never offered for an
 * external endpoint, and the backend rejects it if sent.
 */

/** A map of client-facing model name -> source, as stored on an endpoint spec. */
export type ModelSourceMap = Record<string, string> | null | undefined;

/**
 * A source label value. Deliberately a bare `string`: the preset list below is
 * a UI convenience, not a closed set, and a slug this build has never heard of
 * must still render (as itself) rather than crash or show blank.
 */
export type ModelSource = string;

/** The source every internal endpoint derives, and no external endpoint may claim. */
export const SELF_HOSTED_MODEL_SOURCE = "self-hosted";

/**
 * The source derived for a model an external endpoint reaches through an
 * internal endpoint of this platform.
 *
 * Deliberately not `self-hosted`, even though the model really is hosted here:
 * the row is still an external one, and `self-hosted` has to stay one-to-one
 * with internal endpoints for the API-key picker to tell the two rows for one
 * model name apart.
 */
export const INTERNAL_SHARED_MODEL_SOURCE = "internal-shared";

/**
 * The presets offered in the UI, in the order they are shown and grouped.
 *
 * Adding a source means adding a slug here and a string under
 * `modelSource.values` in the locale files — no other code changes. A value
 * outside this list still displays; it just sorts last and shows its raw slug.
 */
export const PRESET_MODEL_SOURCES: readonly ModelSource[] = [
  SELF_HOSTED_MODEL_SOURCE,
  "internal-shared",
  "third-party-public",
  "partner",
];

/**
 * The presets an admin may assign to an external endpoint.
 *
 * Note that `internal-shared` is in here: "internal" there describes who runs
 * the model, not which kind of endpoint fronts it. It is an external endpoint
 * and must not be grouped with the self-hosted ones.
 */
export const EXTERNAL_MODEL_SOURCES: readonly ModelSource[] =
  PRESET_MODEL_SOURCES.filter((source) => source !== SELF_HOSTED_MODEL_SOURCE);

/**
 * The kind of endpoint serving a model — the `type` half of an allowlist
 * entry. Not exported: callers pass the literal, and the union is what makes a
 * misspelling a type error at the call site, which is the guarantee.
 */
type ModelEndpointKind = "internal" | "external";

/**
 * Read one model's stored source off an endpoint's `spec.model_sources`.
 *
 * A stored `self-hosted` is ignored rather than returned. The server rejects
 * that value on an external endpoint, but a row written before the guard — or
 * through any path that ever bypasses it — must not be able to make an external
 * row render as self-hosted: that is the one-to-one mapping the API-key picker
 * leans on to tell the internal and external rows for a model name apart.
 */
export function readStoredModelSource(
  modelSources: ModelSourceMap,
  model: string,
): ModelSource | undefined {
  const raw = modelSources?.[model];
  const trimmed = String(raw ?? "").trim();
  if (trimmed === "" || trimmed === SELF_HOSTED_MODEL_SOURCE) return undefined;
  return trimmed;
}

/**
 * The source label to show for a model served by an endpoint of `kind`.
 *
 * Internal wins over anything stored: the derivation is the contract the
 * picker's IE-vs-EE distinction rests on, so a stray label on an internal
 * endpoint must not be able to break it. External endpoints fall back to
 * `undefined` when unlabelled — callers render that as "unspecified", which is
 * still its own group and so still distinct from `self-hosted`.
 */
export function resolveModelSource(
  kind: ModelEndpointKind,
  modelSources?: ModelSourceMap,
  model?: string,
  opts?: {
    /**
     * The model is reached through an upstream that points at an internal
     * endpoint, which makes it internal by construction — so it resolves
     * without the admin having to say anything. An explicit source still wins.
     */
    viaInternalEndpoint?: boolean;
  },
): ModelSource | undefined {
  if (kind === "internal") return SELF_HOSTED_MODEL_SOURCE;
  if (!model) return undefined;

  return (
    readStoredModelSource(modelSources, model) ??
    (opts?.viaInternalEndpoint ? INTERNAL_SHARED_MODEL_SOURCE : undefined)
  );
}

/**
 * The client-facing model names an endpoint reaches through an upstream that
 * points at an internal endpoint.
 *
 * Takes the bare upstream shape rather than the domain type so this stays in
 * the foundation layer.
 */
export function modelsViaInternalEndpoint(
  upstreams:
    | {
        endpoint_ref?: string | null;
        model_mapping?: Record<string, string> | null;
      }[]
    | null
    | undefined,
): Set<string> {
  const models = new Set<string>();

  for (const upstream of upstreams ?? []) {
    if (!String(upstream?.endpoint_ref ?? "").trim()) continue;
    for (const model of Object.keys(upstream?.model_mapping ?? {})) {
      models.add(model);
    }
  }

  return models;
}

/**
 * Sort key for a source: presets in declared order, then unknown slugs
 * (alphabetically, via the caller's tiebreak), then "unspecified" last.
 */
export function modelSourceRank(source: ModelSource | undefined): number {
  if (!source) return PRESET_MODEL_SOURCES.length + 1;
  const index = PRESET_MODEL_SOURCES.indexOf(source);
  return index === -1 ? PRESET_MODEL_SOURCES.length : index;
}

/**
 * The translation key for a source, for `t(key, { defaultValue: source })`.
 *
 * The `defaultValue` is what makes an unrecognised slug degrade to itself: the
 * enum is extensible on the server, so a build older than the deployment will
 * see slugs it has no string for, and showing the raw slug is strictly better
 * than showing nothing.
 */
export function modelSourceTranslationKey(source: ModelSource): string {
  return `modelSource.values.${source}`;
}

/**
 * The column `api.get_workspace_models(p_workspace)` returns the resolved
 * source label in.
 *
 * **Adapter seam.** At the time of writing the backend had not yet landed the
 * migration that adds this column — the RPC still returns only
 * `(model, source, endpoint_name)`, where `source` is the endpoint *kind*
 * (`endpoint` / `external_endpoint`), not a source label. The picker therefore
 * still derives the label client-side from the endpoint records it already
 * lists (see `useWorkspaceModels`). When the RPC does carry it, reading it is
 * this constant plus {@link modelSourceFromWorkspaceModelRow}; if the backend
 * spells the column something other than `source_label`, changing that spelling
 * here is the whole change.
 */
export const WORKSPACE_MODEL_SOURCE_COLUMN = "source_label";

/**
 * One endpoint's contribution to the suggestion list: what it has assigned, and
 * which models it actually exposes.
 */
type ModelSourceUsage = {
  modelSources: ModelSourceMap;
  /** Client-facing names the endpoint currently serves. */
  models: Iterable<string>;
};

/**
 * The sources an admin can pick for a model: the presets, plus every value
 * still in use, in preset-then-alphabetical order.
 *
 * Including the in-use values is what keeps a free-text field from fragmenting.
 * The enum is open by design — the server stores any string — so the second
 * person to need "acme-research-lab" must be able to find it in the list rather
 * than retype it and risk "acme-research-labs". No storage backs this: the set
 * is derived from the endpoints themselves, so it maintains itself.
 *
 * "In use" means a model that still exists. Nothing prunes spec.model_sources
 * when a model is removed, so an endpoint keeps entries for models it no longer
 * serves; counting those would keep suggesting a value that nothing uses any
 * more, which is the opposite of the list's purpose.
 *
 * `self-hosted` can never appear: it is derived for internal endpoints and the
 * server rejects it here, so a stored one (however it got there) is filtered
 * out rather than offered.
 */
export function externalModelSourceSuggestions(
  usage: Iterable<ModelSourceUsage>,
): ModelSource[] {
  const seen = new Set<ModelSource>(EXTERNAL_MODEL_SOURCES);

  for (const { modelSources, models } of usage) {
    for (const model of models) {
      const source = String(modelSources?.[model] ?? "").trim();
      if (source && source !== SELF_HOSTED_MODEL_SOURCE) seen.add(source);
    }
  }

  return [...seen].sort((a, b) => {
    const rank = modelSourceRank(a) - modelSourceRank(b);
    return rank !== 0 ? rank : a.localeCompare(b);
  });
}

/** Read the source label out of a `get_workspace_models` row. */
export function modelSourceFromWorkspaceModelRow(
  row: Record<string, unknown> | null | undefined,
): ModelSource | undefined {
  const raw = row?.[WORKSPACE_MODEL_SOURCE_COLUMN];
  const trimmed = String(raw ?? "").trim();
  return trimmed === "" ? undefined : trimmed;
}
