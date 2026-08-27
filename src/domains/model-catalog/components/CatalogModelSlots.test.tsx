import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  registries: [] as unknown[],
  engines: [] as unknown[],
  models: [] as unknown[],
  info: null as unknown,
  infoLoading: false,
  versionRefs: [] as { registry?: string; model?: string }[],
}));

vi.mock("@refinedev/core", () => ({
  useSelect: ({ resource }: { resource: string }) => ({
    query: {
      data: {
        data: resource === "engines" ? mocks.engines : mocks.registries,
      },
      isLoading: false,
    },
  }),
}));

vi.mock("@/foundation/hooks/use-registry-models", () => ({
  useRegistryModels: () => ({
    page: null,
    models: mocks.models,
    total: null,
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/foundation/hooks/use-registry-model-version", () => ({
  useRegistryModelVersion: (ref: { registry?: string; model?: string }) => {
    if (ref.model) mocks.versionRefs.push(ref);

    return {
      model:
        ref.model && !mocks.infoLoading
          ? { name: ref.model, info: mocks.info }
          : null,
      isLoading: Boolean(ref.model) && mocks.infoLoading,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    };
  },
}));

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/components/ui/combobox", () => ({
  Combobox: ({
    onChange,
    options,
    value,
    placeholder,
    disabled,
  }: {
    onChange: (value: string) => void;
    options: { label: string; value: string; disabled?: boolean }[];
    value: string;
    placeholder: string;
    disabled?: boolean;
  }) => (
    <select
      aria-label={placeholder}
      disabled={disabled}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="" />
      {options.map((option) => (
        <option
          key={option.value}
          value={option.value}
          disabled={option.disabled}
        >
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

import { CatalogModelSlots } from "./CatalogModelSlots";

const registry = (name: string, phase = "Connected") => ({
  metadata: { name, workspace: "team-a", deletion_timestamp: null },
  status: { phase },
});

const recipeDoc = {
  apiVersion: "v1",
  kind: "ModelCatalog",
  metadata: { name: "qwen", workspace: "team-a" },
  spec: {
    variants: {
      bf16: { model: { registry: "huggingface", name: "Qwen/Qwen3-27B" } },
      fp8: {},
    },
    features: [{ name: "max-model-len" }],
  },
};

function renderPanel(doc: unknown = recipeDoc) {
  const onChange = vi.fn();
  render(
    <CatalogModelSlots doc={doc} onChange={onChange} workspace="team-a" />,
  );
  return onChange;
}

type SavedDoc = {
  metadata: Record<string, unknown>;
  spec: {
    model?: Record<string, unknown>;
    variants?: Record<string, { model?: Record<string, unknown> }>;
    features?: unknown;
  };
};

const nextDoc = (onChange: ReturnType<typeof vi.fn>, call = 0) =>
  onChange.mock.calls[call][0] as SavedDoc;

const pickModel = (slotId: string, model: string) => {
  const row = screen.getByTestId(`catalog-model-slot-${slotId}`);
  fireEvent.change(
    within(row).getByLabelText("model_catalogs.models.selectModel"),
    { target: { value: model } },
  );
};

beforeEach(() => {
  mocks.registries = [registry("local-nfs"), registry("huggingface")];
  mocks.models = [
    { name: "qwen3-27b", versions: [{ name: "v1", creation_time: "" }] },
  ];
  mocks.info = null;
  mocks.infoLoading = false;
  mocks.versionRefs = [];
  mocks.engines = [
    {
      metadata: { name: "vllm" },
      spec: { versions: [{ version: "0.24" }, { version: "0.25" }] },
    },
    {
      metadata: { name: "sglang" },
      spec: { versions: [{ version: "0.5" }] },
    },
  ];
});

describe("CatalogModelSlots", () => {
  it("shows a row per variant, labelled by variant key", () => {
    renderPanel();

    expect(screen.getByTestId("catalog-model-slot-variant.bf16")).toBeDefined();
    expect(screen.getByTestId("catalog-model-slot-variant.fp8")).toBeDefined();
    expect(screen.getByText("bf16")).toBeDefined();
  });

  // The server refuses a variant with no model, so this only happens mid-edit
  // — which is exactly when the picker is worth offering.
  it("says so when a variant names no model", () => {
    renderPanel();

    const row = screen.getByTestId("catalog-model-slot-variant.fp8");
    expect(
      within(row).queryByText("model_catalogs.models.unset"),
    ).not.toBeNull();
  });

  it("repoints one variant and leaves the rest of the document alone", async () => {
    const onChange = renderPanel();

    pickModel("variant.bf16", "qwen3-27b");

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const doc = nextDoc(onChange);
    expect(doc.spec.variants?.bf16.model).toMatchObject({
      registry: "huggingface",
      name: "qwen3-27b",
      version: "v1",
    });
    expect(doc.spec.features).toEqual(recipeDoc.spec.features);
    expect(doc.metadata).toEqual(recipeDoc.metadata);
  });

  it("gives an inheriting variant a model of its own", async () => {
    const onChange = renderPanel();

    pickModel("variant.fp8", "qwen3-27b");

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(nextDoc(onChange).spec.variants?.fp8.model).toMatchObject({
      name: "qwen3-27b",
    });
  });

  // Hand-editing the text and using this panel have to be interchangeable, so
  // the panel says why it cannot help rather than rendering an empty list that
  // reads as "this catalog names no models". The caller reports the text not
  // parsing by handing over a null document.
  it("stands down while the YAML does not parse", () => {
    render(
      <CatalogModelSlots doc={null} onChange={vi.fn()} workspace="team-a" />,
    );

    expect(screen.queryByTestId("catalog-model-slots")).toBeNull();
    expect(screen.getByText("model_catalogs.models.unparsable")).toBeDefined();
  });

  it("cannot pick a model before a registry is chosen", () => {
    mocks.registries = [];
    renderPanel({
      apiVersion: "v1",
      kind: "ModelCatalog",
      metadata: { name: "q", workspace: "team-a" },
      spec: { model: { name: "plain" } },
    });

    const row = screen.getByTestId("catalog-model-slot-catalog");
    expect(
      (
        within(row).getByLabelText(
          "model_catalogs.models.selectModel",
        ) as HTMLSelectElement
      ).disabled,
    ).toBe(true);
  });

  it("offers an unreachable registry but does not let it be chosen", () => {
    mocks.registries = [registry("local-nfs"), registry("down", "Failed")];
    renderPanel();

    const select = screen.getByLabelText(
      "model_catalogs.models.selectRegistry",
    );
    const option = within(select).getByText("down") as HTMLOptionElement;
    expect(option.disabled).toBe(true);
  });
});

describe("engine version", () => {
  const withEngine = (engineName: string) => ({
    apiVersion: "v1",
    kind: "ModelCatalog",
    metadata: { name: "q", workspace: "team-a" },
    spec: {
      engine: { engine: engineName, version: "0.24" },
      model: { registry: "huggingface", name: "Qwen/Qwen3-8B" },
    },
  });

  it("shows the engine as a fact and offers only its versions", () => {
    renderPanel(withEngine("vllm"));

    const row = screen.getByTestId("catalog-engine-version");
    expect(within(row).getByText("vllm")).toBeDefined();

    const select = within(row).getByLabelText(
      "model_catalogs.models.selectEngineVersion",
    );
    const offered = within(select)
      .getAllByRole("option")
      .map((option) => (option as HTMLOptionElement).value)
      .filter(Boolean);
    expect(offered).toEqual(["0.24", "0.25"]);
  });

  it("switches the version and leaves the engine alone", () => {
    const onChange = renderPanel(withEngine("vllm"));

    const row = screen.getByTestId("catalog-engine-version");
    fireEvent.change(
      within(row).getByLabelText("model_catalogs.models.selectEngineVersion"),
      { target: { value: "0.25" } },
    );

    const doc = nextDoc(onChange) as unknown as {
      spec: { engine: { engine: string; version: string } };
    };
    expect(doc.spec.engine).toEqual({ engine: "vllm", version: "0.25" });
  });

  it("renders no engine row when the catalog names none", () => {
    renderPanel();

    expect(screen.queryByTestId("catalog-engine-version")).toBeNull();
  });
});

describe("a registry change while a pick is still resolving", () => {
  // The detail read and the follow-up `info` write are anchored to the registry
  // the model was picked from. Keyed on the live combobox instead, they would
  // ask a different registry for the model, or stop asking entirely.
  it("keeps reading the registry the model was picked from", () => {
    mocks.infoLoading = true;
    renderPanel();

    pickModel("variant.bf16", "qwen3-27b");
    fireEvent.change(
      screen.getByLabelText("model_catalogs.models.selectRegistry"),
      { target: { value: "local-nfs" } },
    );

    expect(mocks.versionRefs.length).toBeGreaterThan(0);
    for (const ref of mocks.versionRefs) {
      expect(ref.registry).toBe("huggingface");
    }
  });
});
