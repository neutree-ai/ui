import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { ModelCatalog } from "@/domains/model-catalog/types";

const mocks = vi.hoisted(() => ({ save: vi.fn(), record: {} as ModelCatalog }));

vi.mock("@refinedev/core", () => ({
  useShow: () => ({
    query: { data: { data: mocks.record }, isLoading: false },
  }),
  useUpdate: () => ({ mutateAsync: mocks.save, isLoading: false }),
}));
vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({ workspace: "team-a" }),
}));
vi.mock("@/foundation/components/PageHeader", () => ({
  PageHeader: () => null,
}));
vi.mock("@/domains/model-catalog/components/CatalogModelSlots", () => ({
  CatalogModelSlots: () => null,
}));
vi.mock("@/domains/endpoint/components/ImageExplorerButton", () => ({
  ImageExplorerButton: () => null,
}));

import { ModelCatalogsEdit } from "./edit";

const makeCatalog = (): ModelCatalog =>
  ({
    id: 7,
    api_version: "v1",
    kind: "ModelCatalog",
    metadata: {
      name: "catalog-a",
      workspace: "team-a",
      display_name: "Catalog A",
      labels: { tier: "gold" },
      annotations: { source: "library" },
      creation_timestamp: "2026-01-01T00:00:00Z",
    },
    spec: {
      model: { name: "model-a", registry: "hub" },
      engine: { engine: "vllm", version: "1" },
      resources: null,
      replicas: { num: 1 },
      deployment_options: {},
      variables: { enabled: false, limit: 0, optional: null },
      env: { TOKEN: "" },
    },
    status: { phase: "Ready" },
  }) as unknown as ModelCatalog;

beforeEach(() => {
  mocks.save.mockReset().mockResolvedValue({});
  mocks.record = makeCatalog();
});

async function openEditor() {
  render(
    <TooltipProvider>
      <ModelCatalogsEdit />
    </TooltipProvider>,
  );
  return screen.findByRole("textbox", {
    name: "model_catalogs.edit.specLabel",
  });
}

async function save() {
  fireEvent.click(screen.getByRole("button", { name: "buttons.save" }));
  await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce());
  return mocks.save.mock.calls[0][0].values;
}

describe("ModelCatalogsEdit payload", () => {
  it("reopens an API record and pins null omission on untouched save", async () => {
    await openEditor();

    expect(await save()).toEqual({
      ...mocks.record,
      spec: {
        model: { name: "model-a", registry: "hub" },
        engine: { engine: "vllm", version: "1" },
        replicas: { num: 1 },
        deployment_options: {},
        variables: { enabled: false, limit: 0 },
        env: { TOKEN: "" },
      },
    });
  });

  it.each([
    [
      "bare spec preserves metadata and sends explicit nulls",
      "model: {name: changed}\nresources: null\nenv: {TOKEN: ''}",
      { model: { name: "changed" }, resources: null, env: { TOKEN: "" } },
      { labels: { tier: "gold" }, annotations: { source: "library" } },
    ],
    [
      "document replaces metadata maps but ignores display name",
      "kind: ModelCatalog\nmetadata: {display_name: Renamed, labels: {tier: silver, count: 2}}\nspec: {model: {name: changed}}",
      { model: { name: "changed" } },
      { labels: { tier: "silver" }, annotations: {} },
    ],
    ["empty spec reaches the API", "{}", {}, {}],
  ])("%s", async (_name, text, spec, metadata) => {
    const editor = await openEditor();
    fireEvent.change(editor, { target: { value: text } });

    expect(await save()).toEqual({
      ...mocks.record,
      metadata: { ...mocks.record.metadata, ...metadata },
      spec,
    });
  });
});
