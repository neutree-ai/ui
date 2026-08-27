import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
  ShowPage.ObjectHeader = ({ title }: { title: ReactNode }) => <h1>{title}</h1>;
  ShowPage.Meta = ({ children }: { children: ReactNode }) => (
    <span>{children}</span>
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
  default: () => null,
}));
vi.mock(
  "@/domains/model-registry/components/RegistryAvailabilityNotice",
  () => ({ RegistryAvailabilityNotice: () => null }),
);
vi.mock("@/domains/model-registry/components/RegistryVisibility", () => ({
  RegistryVisibility: () => null,
}));
vi.mock("@/foundation/components/MetadataTimestampMeta", () => ({
  MetadataTimestampMeta: () => null,
}));

import { ModelRegistriesShow } from "./show";

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
    render(<ModelRegistriesShow />);

    expect(screen.getByTestId("model-drawer").dataset.open).toBe("false");
    fireEvent.click(screen.getByText("Select model"));
    expect(screen.getByTestId("model-drawer").dataset.open).toBe("true");
    expect(screen.getByTestId("model-drawer").textContent).toContain(
      "org/model",
    );

    fireEvent.click(screen.getByText("Close drawer"));
    expect(screen.getByTestId("model-drawer").dataset.open).toBe("false");
  });
});
