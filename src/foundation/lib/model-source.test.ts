import { describe, expect, it } from "vitest";
import {
  EXTERNAL_MODEL_SOURCES,
  externalModelSourceSuggestions,
  MODEL_SOURCE_LABEL_KEY,
  modelSourceFromWorkspaceModelRow,
  modelSourceRank,
  modelSourceTranslationKey,
  PRESET_MODEL_SOURCES,
  readStoredModelSource,
  resolveModelSource,
  SELF_HOSTED_MODEL_SOURCE,
  WORKSPACE_MODEL_SOURCE_COLUMN,
} from "./model-source";

describe("resolveModelSource", () => {
  it("derives self-hosted for every internal endpoint", () => {
    expect(resolveModelSource("internal")).toBe(SELF_HOSTED_MODEL_SOURCE);
    expect(resolveModelSource("internal", {})).toBe(SELF_HOSTED_MODEL_SOURCE);
  });

  it("ignores a stray stored label on an internal endpoint", () => {
    // self-hosted <-> internal must stay one-to-one: it is the only thing
    // distinguishing the internal row from the external row for the same model
    // name in the API-key picker, so a stored label cannot override it.
    expect(
      resolveModelSource("internal", {
        [MODEL_SOURCE_LABEL_KEY]: "third-party-public",
      }),
    ).toBe(SELF_HOSTED_MODEL_SOURCE);
  });

  it("reads the stored label for an external endpoint", () => {
    expect(
      resolveModelSource("external", {
        [MODEL_SOURCE_LABEL_KEY]: "partner",
      }),
    ).toBe("partner");
  });

  it("passes through a slug this build does not know", () => {
    // The enum is extensible server-side; an unrecognised value must survive
    // to the renderer, which shows it verbatim.
    expect(
      resolveModelSource("external", {
        [MODEL_SOURCE_LABEL_KEY]: "government-cloud",
      }),
    ).toBe("government-cloud");
  });

  it("is undefined for an unlabelled or blank-labelled external endpoint", () => {
    expect(resolveModelSource("external")).toBeUndefined();
    expect(resolveModelSource("external", {})).toBeUndefined();
    expect(
      resolveModelSource("external", { [MODEL_SOURCE_LABEL_KEY]: "   " }),
    ).toBeUndefined();
  });

  it("never reports self-hosted for an external endpoint that claims it", () => {
    // The backend rejects this value on an external endpoint, but a record
    // written before that guard must not be able to impersonate an internal
    // one. It is reported as-is and the picker still groups it apart by the
    // endpoint kind it was built from.
    expect(readStoredModelSource({})).toBeUndefined();
    expect(EXTERNAL_MODEL_SOURCES).not.toContain(SELF_HOSTED_MODEL_SOURCE);
  });
});

describe("EXTERNAL_MODEL_SOURCES", () => {
  it("offers every preset except self-hosted", () => {
    expect([...EXTERNAL_MODEL_SOURCES]).toEqual(
      PRESET_MODEL_SOURCES.filter((s) => s !== SELF_HOSTED_MODEL_SOURCE),
    );
  });

  it("keeps internal-shared, which is an external endpoint despite its name", () => {
    expect(EXTERNAL_MODEL_SOURCES).toContain("internal-shared");
  });
});

describe("modelSourceRank", () => {
  it("orders presets as declared", () => {
    expect(modelSourceRank(SELF_HOSTED_MODEL_SOURCE)).toBe(0);
    expect(modelSourceRank("internal-shared")).toBe(1);
    expect(modelSourceRank("third-party-public")).toBe(2);
    expect(modelSourceRank("partner")).toBe(3);
  });

  it("sorts unknown slugs after every preset, and unspecified last", () => {
    const unknown = modelSourceRank("government-cloud");
    expect(unknown).toBeGreaterThan(modelSourceRank("partner"));
    expect(modelSourceRank(undefined)).toBeGreaterThan(unknown);
  });
});

describe("modelSourceTranslationKey", () => {
  it("namespaces the slug under modelSource.values", () => {
    expect(modelSourceTranslationKey("partner")).toBe(
      "modelSource.values.partner",
    );
  });
});

describe("modelSourceFromWorkspaceModelRow", () => {
  it("reads the adapter column off an RPC row", () => {
    expect(
      modelSourceFromWorkspaceModelRow({
        model: "qwen",
        [WORKSPACE_MODEL_SOURCE_COLUMN]: "partner",
      }),
    ).toBe("partner");
  });

  it("is undefined when the column is absent, empty or the row is missing", () => {
    // The column is the seam for the not-yet-landed backend migration: until
    // it exists, every row reads as unlabelled rather than throwing.
    expect(modelSourceFromWorkspaceModelRow({ model: "qwen" })).toBeUndefined();
    expect(
      modelSourceFromWorkspaceModelRow({
        [WORKSPACE_MODEL_SOURCE_COLUMN]: "",
      }),
    ).toBeUndefined();
    expect(modelSourceFromWorkspaceModelRow(null)).toBeUndefined();
  });
});

describe("externalModelSourceSuggestions", () => {
  const labelled = (source: string) => ({ [MODEL_SOURCE_LABEL_KEY]: source });

  it("offers the presets when nothing is in use yet", () => {
    expect(externalModelSourceSuggestions([])).toEqual([
      ...EXTERNAL_MODEL_SOURCES,
    ]);
  });

  it("adds values already in use, after the presets", () => {
    // This is what keeps an open enum from fragmenting: the second person to
    // need a custom source finds it in the list instead of retyping it.
    expect(
      externalModelSourceSuggestions([
        labelled("acme-research-lab"),
        labelled("partner"),
        null,
        undefined,
        {},
      ]),
    ).toEqual([...EXTERNAL_MODEL_SOURCES, "acme-research-lab"]);
  });

  it("sorts unknown values alphabetically among themselves", () => {
    expect(
      externalModelSourceSuggestions([
        labelled("zeta-lab"),
        labelled("alpha-lab"),
      ]),
    ).toEqual([...EXTERNAL_MODEL_SOURCES, "alpha-lab", "zeta-lab"]);
  });

  it("never offers self-hosted, even if one is somehow stored", () => {
    // self-hosted is derived for internal endpoints and rejected by the server
    // here; offering it would collapse the IE/EE distinction the API-key model
    // picker depends on.
    expect(
      externalModelSourceSuggestions([labelled(SELF_HOSTED_MODEL_SOURCE)]),
    ).not.toContain(SELF_HOSTED_MODEL_SOURCE);
  });

  it("does not repeat a preset that is also in use", () => {
    expect(
      externalModelSourceSuggestions([
        labelled("partner"),
        labelled("partner"),
      ]),
    ).toEqual([...EXTERNAL_MODEL_SOURCES]);
  });
});
