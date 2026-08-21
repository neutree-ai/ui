import { describe, expect, it } from "vitest";
import type { RecipeVariant } from "@/foundation/recipe/types";
import {
  buildCatalogUpdateValues,
  type CatalogImportCandidate,
  resolveCatalogImportAction,
  runCatalogImport,
} from "./catalog-import";

const recipeSpec = {
  variants: { bf16: {}, fp8: {} } as Record<string, RecipeVariant>,
};
const plainSpec = { variants: null };

describe("resolveCatalogImportAction", () => {
  it("creates when the name is free, updates when it is taken", () => {
    expect(resolveCatalogImportAction(null, recipeSpec)).toBe("create");
    expect(resolveCatalogImportAction({ spec: recipeSpec }, recipeSpec)).toBe(
      "update",
    );
  });

  it("flags a type change in both directions", () => {
    expect(resolveCatalogImportAction({ spec: recipeSpec }, plainSpec)).toBe(
      "update-type-change",
    );
    expect(resolveCatalogImportAction({ spec: plainSpec }, recipeSpec)).toBe(
      "update-type-change",
    );
  });

  it("reads the type off variants, not off the field being present", () => {
    // `variants: {}` is a plain catalog — a recipe needs at least one variant —
    // so re-importing one over a plain catalog must not read as a type change.
    expect(
      resolveCatalogImportAction({ spec: { variants: {} } }, plainSpec),
    ).toBe("update");
    expect(resolveCatalogImportAction({ spec: null }, recipeSpec)).toBe(
      "update-type-change",
    );
  });
});

describe("buildCatalogUpdateValues", () => {
  const incoming = {
    api_version: "v1",
    kind: "ModelCatalog",
    metadata: { name: "qwen3", workspace: "ws-a", labels: {} },
    spec: { variants: { fp8: {} } },
  };

  it("keeps stored metadata the import is silent about, replaces the spec outright", () => {
    // Metadata merges so an import that omits display_name does not blank it;
    // the spec does not, because re-importing is how a variant gets removed.
    const values = buildCatalogUpdateValues(
      {
        metadata: { name: "qwen3", display_name: "Qwen 3" },
        spec: {
          variants: { bf16: {}, fp8: {} } as Record<string, RecipeVariant>,
        },
      },
      incoming,
    );

    expect(values.metadata).toEqual({
      name: "qwen3",
      workspace: "ws-a",
      display_name: "Qwen 3",
      labels: {},
    });
    expect(values.spec).toEqual({ variants: { fp8: {} } });
  });
});

type Written = { action: string; name: string; workspace: string };

function harness(
  store: Record<
    string,
    { spec?: { variants?: Record<string, RecipeVariant> | null } | null }
  >,
  overrides: Partial<Parameters<typeof runCatalogImport>[1]> = {},
) {
  const written: Written[] = [];
  const confirmations: string[][] = [];

  const deps = {
    readExisting: async (name: string, workspace: string) =>
      store[`${workspace}/${name}`] ?? null,
    write: async ({ action, name, workspace }: Written) => {
      written.push({ action, name, workspace });
    },
    confirmTypeChange: async (names: string[]) => {
      confirmations.push(names);
      return true;
    },
    ...overrides,
  };

  return { deps, written, confirmations };
}

const candidate = (
  index: number,
  name: string,
  spec: { variants?: Record<string, RecipeVariant> | null } | null,
  workspace = "ws-a",
): CatalogImportCandidate => ({
  index,
  name,
  workspace,
  values: { metadata: { name, workspace }, spec },
  spec,
});

describe("runCatalogImport", () => {
  it("creates a free name and updates a taken one", async () => {
    const h = harness({ "ws-a/taken": { spec: plainSpec } });

    const run = await runCatalogImport(
      [candidate(0, "free", plainSpec), candidate(1, "taken", plainSpec)],
      h.deps,
    );

    expect(run).toEqual({
      cancelled: false,
      outcomes: [
        { index: 0, name: "free", status: "ok", action: "create" },
        { index: 1, name: "taken", status: "ok", action: "update" },
      ],
    });
    expect(h.confirmations).toHaveLength(0);
  });

  it("scopes the lookup to the candidate's own workspace", async () => {
    // The same name in another workspace is a different catalog, so it must be
    // created here rather than updated there.
    const h = harness({ "ws-b/qwen3": { spec: plainSpec } });

    await runCatalogImport([candidate(0, "qwen3", plainSpec)], h.deps);

    expect(h.written).toEqual([
      { action: "create", name: "qwen3", workspace: "ws-a" },
    ]);
  });

  it("confirms a type change before writing anything", async () => {
    const order: string[] = [];
    const h = harness(
      { "ws-a/qwen3": { spec: recipeSpec } },
      {
        confirmTypeChange: async (names: string[]) => {
          order.push(`confirm:${names.join(",")}`);
          return true;
        },
        write: async ({ name }: Written) => {
          order.push(`write:${name}`);
        },
      },
    );

    await runCatalogImport(
      [candidate(0, "other", plainSpec), candidate(1, "qwen3", plainSpec)],
      h.deps,
    );

    // Only the catalog whose type flips is named, and no write — not even the
    // unrelated create — precedes the question.
    expect(order).toEqual(["confirm:qwen3", "write:other", "write:qwen3"]);
  });

  it("writes nothing at all when the type change is declined", async () => {
    const h = harness(
      { "ws-a/qwen3": { spec: recipeSpec } },
      { confirmTypeChange: async () => false },
    );

    const run = await runCatalogImport(
      [candidate(0, "other", plainSpec), candidate(1, "qwen3", plainSpec)],
      h.deps,
    );

    expect(run).toEqual({ cancelled: true });
    expect(h.written).toHaveLength(0);
  });

  it("reports a rejected write without stopping the rest of the batch", async () => {
    const h = harness(
      {},
      {
        write: async ({ name }: Written) => {
          if (name === "bad")
            throw new Error("spec.variants must be an object");
        },
      },
    );

    const run = await runCatalogImport(
      [candidate(0, "bad", plainSpec), candidate(1, "good", plainSpec)],
      h.deps,
    );

    expect(run).toMatchObject({
      cancelled: false,
      outcomes: [
        { index: 0, name: "bad", status: "error" },
        { index: 1, name: "good", status: "ok", action: "create" },
      ],
    });
  });

  it("reports a failed lookup instead of guessing that the name is free", async () => {
    // Treating an unreachable store as "does not exist" would turn a transient
    // failure into a create that collides with the catalog already there.
    const h = harness(
      {},
      {
        readExisting: async () => {
          throw new Error("network");
        },
      },
    );

    const run = await runCatalogImport(
      [candidate(0, "qwen3", plainSpec)],
      h.deps,
    );

    expect(run).toMatchObject({
      outcomes: [{ index: 0, status: "error" }],
    });
    expect(h.written).toHaveLength(0);
  });
});
