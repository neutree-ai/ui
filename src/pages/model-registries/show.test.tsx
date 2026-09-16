import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";

const state = vi.hoisted(() => ({
  isLoading: false,
  record: null as Record<string, unknown> | null,
}));

vi.mock("@refinedev/core", () => ({
  useParsed: () => ({ params: { workspace: "design-lab" } }),
  useShow: () => ({
    query: {
      data: state.record ? { data: state.record } : undefined,
      isLoading: state.isLoading,
    },
  }),
}));

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/foundation/components/ShowPage", () => {
  const ShowPage = ({ children }: { children: ReactNode }) => (
    <main>{children}</main>
  );
  ShowPage.ObjectHeader = ({
    title,
    description,
  }: {
    title: ReactNode;
    description: ReactNode;
  }) => (
    <header>
      <h1>{title}</h1>
      <div data-testid="object-header-meta">{description}</div>
    </header>
  );
  ShowPage.Meta = ({
    label,
    children,
  }: {
    label: ReactNode;
    children: ReactNode;
  }) => (
    <span>
      {label}:{children}
    </span>
  );
  return { ShowPage };
});

vi.mock("@/domains/model-registry/components/RegistryModelsTable", () => ({
  RegistryModelsTable: ({
    onModelSelect,
  }: {
    onModelSelect: (model: string, version: string) => void;
  }) => (
    <button
      type="button"
      onClick={() => onModelSelect("org/model", "revision-1")}
    >
      Select model
    </button>
  ),
}));

vi.mock("@/domains/model-registry/components/ModelDetailDrawer", () => ({
  ModelDetailDrawer: ({
    open,
    selection,
    onOpenChange,
  }: {
    open: boolean;
    selection: { model: string; version: string } | null;
    onOpenChange: (open: boolean) => void;
  }) => (
    <div data-testid="model-drawer" data-open={String(open)}>
      {selection?.model}
      {open ? (
        <button type="button" onClick={() => onOpenChange(false)}>
          Close drawer
        </button>
      ) : null}
    </div>
  ),
}));

vi.mock("@/domains/model-registry/components/ModelRegistryStatus", () => ({
  default: () => null,
}));
vi.mock("@/domains/model-registry/components/ModelRegistryType", () => ({
  default: () => <span>ModelScope</span>,
}));
vi.mock(
  "@/domains/model-registry/components/RegistryAvailabilityNotice",
  () => ({ RegistryAvailabilityNotice: () => null }),
);
vi.mock("@/domains/model-registry/components/RegistryVisibility", () => ({
  RegistryVisibility: () => <span>Public</span>,
}));
vi.mock("@/foundation/components/MetadataTimestampMeta", () => ({
  MetadataTimestampMeta: () => <span>Created:3 days ago</span>,
}));

import { ModelRegistriesShow as Page } from "./show";

let currentSearch = "";
const SearchSpy = () => {
  currentSearch = useLocation().search;
  return null;
};

const renderAt = (entry = "/") =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Page />
      <SearchSpy />
    </MemoryRouter>,
  );

const ModelRegistriesShow = () => (
  <MemoryRouter>
    <Page />
  </MemoryRouter>
);

const registry = {
  metadata: { name: "shared-nfs" },
  spec: { type: "bentoml", url: "nfs://models" },
  status: { phase: "Connected" },
  visibility: "private",
};

beforeEach(() => {
  state.isLoading = false;
  state.record = registry;
});

describe("ModelRegistriesShow", () => {
  it("places the address after visibility and before creation time", () => {
    render(<ModelRegistriesShow />);

    expect(screen.getByTestId("object-header-meta").textContent).toBe(
      "common.fields.type:ModelScopemodel_registries.fields.visibility:Publicmodel_registries.fields.url:nfs://modelsCreated:3 days ago",
    );
  });

  // NEU-770: the address used to live in a "Basic" tab, and dropping that tab
  // took the address with it. This asserts the header itself carries it.
  it("shows the registry address", () => {
    render(<ModelRegistriesShow />);

    expect(screen.getByText("nfs://models")).toBeDefined();
  });

  it("links a hub address out", () => {
    state.record = {
      ...registry,
      spec: { type: "hugging-face", url: "https://huggingface.co" },
    };

    render(<ModelRegistriesShow />);

    expect(
      screen
        .getByRole("link", { name: "https://huggingface.co" })
        .getAttribute("href"),
    ).toBe("https://huggingface.co");
  });

  it("shortens an address too long for the header, keeping it readable", () => {
    state.record = {
      ...registry,
      spec: {
        type: "bentoml",
        url: "nfs://models.internal/volumes/models/registry/prod",
      },
    };

    render(
      <TooltipProvider>
        <ModelRegistriesShow />
      </TooltipProvider>,
    );

    expect(
      screen.getByText("nfs://models.internal/…models/registry/prod"),
    ).toBeDefined();
  });

  it("renders loading and not-found states", () => {
    state.isLoading = true;
    const { rerender } = render(<ModelRegistriesShow />);
    expect(screen.getByTitle("Loading...")).toBeDefined();

    state.isLoading = false;
    state.record = null;
    rerender(<ModelRegistriesShow />);
    expect(screen.getByText("pages.error.notFound")).toBeDefined();
  });

  it("opens a selected model in the drawer and clears it on close", () => {
    renderAt();

    expect(screen.getByTestId("model-drawer").dataset.open).toBe("false");
    fireEvent.click(screen.getByText("Select model"));
    expect(screen.getByTestId("model-drawer").dataset.open).toBe("true");
    expect(screen.getByTestId("model-drawer").textContent).toContain(
      "org/model",
    );
    expect(currentSearch).toBe("?model=org%2Fmodel&version=revision-1");

    fireEvent.click(screen.getByText("Close drawer"));
    expect(screen.getByTestId("model-drawer").dataset.open).toBe("false");
    expect(currentSearch).toBe("");
  });

  // NEU-736: the endpoint detail page links to a model through the URL.
  it("opens the model the URL names", () => {
    renderAt("/?model=org%2Fmodel");

    expect(screen.getByTestId("model-drawer").dataset.open).toBe("true");
    expect(screen.getByTestId("model-drawer").textContent).toContain(
      "org/model",
    );
  });
});
