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
 * - **External endpoints** store it, as the `neutree.ai/model-source` entry in
 *   `metadata.labels`. A label value is a free string, which is what makes the
 *   enum extensible without a migration.
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

/** The `metadata.labels` key an external endpoint's source is stored under. */
export const MODEL_SOURCE_LABEL_KEY = "neutree.ai/model-source";

/**
 * A source label value. Deliberately a bare `string`: the preset list below is
 * a UI convenience, not a closed set, and a slug this build has never heard of
 * must still render (as itself) rather than crash or show blank.
 */
export type ModelSource = string;

/** The source every internal endpoint derives, and no external endpoint may claim. */
export const SELF_HOSTED_MODEL_SOURCE = "self-hosted";

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

/** Read the stored label off a resource's `metadata.labels`, if it has one. */
export function readStoredModelSource(
  labels: Record<string, string> | null | undefined,
): ModelSource | undefined {
  const raw = labels?.[MODEL_SOURCE_LABEL_KEY];
  const trimmed = String(raw ?? "").trim();
  return trimmed === "" ? undefined : trimmed;
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
  labels?: Record<string, string> | null,
): ModelSource | undefined {
  if (kind === "internal") return SELF_HOSTED_MODEL_SOURCE;
  return readStoredModelSource(labels);
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

/** Read the source label out of a `get_workspace_models` row. */
export function modelSourceFromWorkspaceModelRow(
  row: Record<string, unknown> | null | undefined,
): ModelSource | undefined {
  const raw = row?.[WORKSPACE_MODEL_SOURCE_COLUMN];
  const trimmed = String(raw ?? "").trim();
  return trimmed === "" ? undefined : trimmed;
}
