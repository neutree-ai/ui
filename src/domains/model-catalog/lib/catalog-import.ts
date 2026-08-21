import { isRecipeShape } from "@/foundation/recipe/normalize";
import type { RecipeVariant } from "@/foundation/recipe/types";

/**
 * What a single import document does to the catalog store.
 *
 * `update-type-change` is an ordinary update to the API. It is separate because
 * it reshapes what the catalog *is* (a Recipe template gains or loses its
 * variants) — the one outcome a user cannot infer from re-importing a name, and
 * so the one that has to be confirmed first.
 */
export type CatalogImportAction = "create" | "update" | "update-type-change";

type VariantCarrier = {
  variants?: Record<string, RecipeVariant> | null;
} | null;

type CatalogLike = {
  metadata?: Record<string, unknown> | null;
  spec?: VariantCarrier;
} | null;

/**
 * resolveCatalogImportAction decides what importing `incomingSpec` under an
 * already-taken (workspace, name) should do.
 *
 * The catalog's type is read off `spec.variants` exactly as the rest of the app
 * reads it (isRecipeShape) rather than off `kind`, because both shapes are
 * `kind: ModelCatalog` — variants is the only thing that distinguishes them.
 */
export function resolveCatalogImportAction(
  existing: CatalogLike | undefined,
  incomingSpec: VariantCarrier | undefined,
): CatalogImportAction {
  if (!existing) return "create";

  return isRecipeShape(existing.spec) === isRecipeShape(incomingSpec)
    ? "update"
    : "update-type-change";
}

/**
 * buildCatalogUpdateValues produces the PATCH body for re-importing a catalog
 * that already exists.
 *
 * PostgREST replaces each supplied top-level column wholesale. Metadata is
 * therefore merged, so an import silent about `display_name` does not blank it;
 * the spec is replaced outright, because re-importing is how a variant gets
 * removed and merging would make removal impossible.
 */
export function buildCatalogUpdateValues(
  existing: CatalogLike,
  incomingValues: Record<string, unknown>,
): Record<string, unknown> {
  const existingMetadata = (existing?.metadata ?? {}) as Record<
    string,
    unknown
  >;
  const incomingMetadata = (incomingValues.metadata ?? {}) as Record<
    string,
    unknown
  >;

  return {
    ...incomingValues,
    metadata: { ...existingMetadata, ...incomingMetadata },
  };
}

/**
 * A document that passed the caller's own validation, resolved down to what a
 * write needs. Building these is the caller's job: it owns YAML shape and
 * wording, this module owns what happens to the store.
 */
export interface CatalogImportCandidate {
  index: number;
  name: string;
  workspace: string;
  values: Record<string, unknown>;
  spec?: VariantCarrier;
}

/** What one candidate did. Carries no user-facing text. */
type CatalogImportOutcome = { index: number; name: string } & (
  | { status: "ok"; action: CatalogImportAction }
  | { status: "error"; error: unknown }
);

type CatalogImportRun =
  | { cancelled: true }
  | { cancelled: false; outcomes: CatalogImportOutcome[] };

interface CatalogImportDeps {
  /** The catalog an import would land on, or null when the name is free. */
  readExisting: (name: string, workspace: string) => Promise<CatalogLike>;
  /** Performs one resolved write. `values` is already merge-corrected. */
  write: (write: {
    action: CatalogImportAction;
    name: string;
    workspace: string;
    values: Record<string, unknown>;
  }) => Promise<unknown>;
  /** Asks whether to overwrite the named catalogs, whose type the import would
   * flip. Called once, before anything has been written. */
  confirmTypeChange: (names: string[]) => Promise<boolean>;
}

/**
 * runCatalogImport writes a batch of catalogs, updating the ones whose
 * (workspace, name) is already taken instead of failing on them.
 *
 * Two passes on purpose. The first resolves every candidate against the store
 * and writes nothing, which is what makes the type-change confirmation
 * meaningful: at the moment the user is asked, no catalog has been touched, so
 * declining leaves the store exactly as it was rather than half-imported.
 *
 * Each write carries the whole spec in one request, so a rejected one (the
 * recipe validation middleware refusing an invalid spec, say) leaves the stored
 * catalog intact — there is no partial-write state to clean up.
 */
export async function runCatalogImport(
  candidates: CatalogImportCandidate[],
  deps: CatalogImportDeps,
): Promise<CatalogImportRun> {
  const outcomes: CatalogImportOutcome[] = [];
  const planned: (CatalogImportCandidate & {
    action: CatalogImportAction;
    existing: CatalogLike;
  })[] = [];

  for (const candidate of candidates) {
    try {
      const existing = await deps.readExisting(
        candidate.name,
        candidate.workspace,
      );
      planned.push({
        ...candidate,
        action: resolveCatalogImportAction(existing, candidate.spec),
        existing,
      });
    } catch (error) {
      // A failed lookup is reported, never read as "the name is free": that
      // would turn a transient failure into a create that collides.
      outcomes.push({
        index: candidate.index,
        name: candidate.name,
        status: "error",
        error,
      });
    }
  }

  const typeChanges = planned.filter((p) => p.action === "update-type-change");

  if (typeChanges.length > 0) {
    const confirmed = await deps.confirmTypeChange(
      typeChanges.map((p) => p.name),
    );
    if (!confirmed) return { cancelled: true };
  }

  for (const plan of planned) {
    try {
      await deps.write({
        action: plan.action,
        name: plan.name,
        workspace: plan.workspace,
        values:
          plan.action === "create"
            ? plan.values
            : buildCatalogUpdateValues(plan.existing, plan.values),
      });
      outcomes.push({
        index: plan.index,
        name: plan.name,
        status: "ok",
        action: plan.action,
      });
    } catch (error) {
      outcomes.push({
        index: plan.index,
        name: plan.name,
        status: "error",
        error,
      });
    }
  }

  outcomes.sort((a, b) => a.index - b.index);

  return { cancelled: false, outcomes };
}
