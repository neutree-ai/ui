import yaml from "js-yaml";
import type { ModelCatalogSpec } from "@/domains/model-catalog/types";

// Discriminated so callers can translate — this layer holds no i18n.
export type ParseCatalogSpecError =
  | { type: "syntax"; message: string }
  | { type: "notAMapping" }
  | { type: "missingSpec" }
  | { type: "wrongKind"; kind: string }
  | { type: "nameMismatch"; expected: string; actual: string }
  | { type: "workspaceMismatch"; expected: string; actual: string };

// The metadata a save may change. Identity (name/workspace) is immutable and
// the timestamps are server-owned, so only these two travel back.
type EditableMetadata = {
  labels: Record<string, string>;
  annotations: Record<string, string>;
};

type ParseCatalogSpecResult =
  | { ok: true; spec: ModelCatalogSpec; metadata?: EditableMetadata }
  | { ok: false; error: ParseCatalogSpecError };

type Mapping = Record<string, unknown>;

function isMapping(value: unknown): value is Mapping {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Identity fields are compared as strings; anything else counts as absent, and
// an absent field on either side contradicts nothing.
function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

// The envelope keys never appear in a bare spec (a ModelCatalogSpec has no
// apiVersion/kind/metadata), so their presence is what marks the input as a
// whole document rather than a spec. Whether that document carries a usable
// `spec` is a separate question — checked at the call site so a malformed
// envelope is rejected, not stored as the spec.
function looksLikeDocument(doc: Mapping): boolean {
  return "apiVersion" in doc || "kind" in doc || "metadata" in doc;
}

// A document states the desired metadata, so an absent map means "no labels"
// rather than "leave them alone" — that is the only way an edit can drop one.
function stringMap(value: unknown): Record<string, string> {
  if (!isMapping(value)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

/**
 * Parse the YAML in the catalog editor.
 *
 * Accepts a full ModelCatalog document — what the editor shows and what users
 * paste — or a bare spec. A document also carries back its editable metadata;
 * a bare spec leaves the record's metadata untouched.
 *
 * A document's identity must match the record being edited: name and workspace
 * are immutable here, so a mismatch means the user pasted a different catalog,
 * and silently saving it would overwrite this one with another's contents.
 */
export function parseCatalogSpecYaml(
  text: string,
  record: { name: string; workspace: string | null },
): ParseCatalogSpecResult {
  let parsed: unknown;
  try {
    parsed = yaml.load(text);
  } catch (e) {
    return {
      ok: false,
      error: {
        type: "syntax",
        message: e instanceof Error ? e.message : String(e),
      },
    };
  }

  if (!isMapping(parsed)) {
    return { ok: false, error: { type: "notAMapping" } };
  }

  if (!looksLikeDocument(parsed)) {
    return { ok: true, spec: parsed as ModelCatalogSpec };
  }

  // It carries envelope keys, so it is meant to be a whole document. If its
  // `spec` is missing or not a mapping, storing the envelope as the spec would
  // reproduce the very corruption this guards against — reject it instead.
  if (!isMapping(parsed.spec)) {
    return { ok: false, error: { type: "missingSpec" } };
  }

  const kind = str(parsed.kind);
  if (kind && kind !== "ModelCatalog") {
    return { ok: false, error: { type: "wrongKind", kind } };
  }

  const metadata = isMapping(parsed.metadata) ? parsed.metadata : {};

  const name = str(metadata.name);
  if (name && name !== record.name) {
    return {
      ok: false,
      error: { type: "nameMismatch", expected: record.name, actual: name },
    };
  }

  const workspace = str(metadata.workspace);
  if (workspace && record.workspace && workspace !== record.workspace) {
    return {
      ok: false,
      error: {
        type: "workspaceMismatch",
        expected: record.workspace,
        actual: workspace,
      },
    };
  }

  return {
    ok: true,
    spec: parsed.spec as ModelCatalogSpec,
    metadata: {
      labels: stringMap(metadata.labels),
      annotations: stringMap(metadata.annotations),
    },
  };
}
