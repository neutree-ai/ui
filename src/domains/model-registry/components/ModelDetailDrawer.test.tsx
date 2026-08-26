import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ModelDetailDrawer } from "@/domains/model-registry/components/ModelDetailDrawer";
import type { ModelRegistry } from "@/domains/model-registry/types";
import { useRegistryModelVersion } from "@/foundation/hooks/use-registry-model-version";

const go = vi.fn();

vi.mock("@refinedev/core", () => ({ useGo: () => go }));
vi.mock("@/foundation/hooks/use-registry-model-version", () => ({
  useRegistryModelVersion: vi.fn(),
}));
vi.mock("@/domains/model-registry/components/ModelReadme", () => ({
  ModelReadme: ({ contentFramed }: { contentFramed?: boolean }) => (
    <div data-testid="model-readme" data-framed={String(contentFramed)} />
  ),
}));
vi.mock("@/domains/model-registry/components/ModelEditDialog", () => ({
  ModelEditDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="model-edit-dialog" /> : null,
}));
vi.mock("@/domains/model-registry/components/ModelDeleteDialog", () => ({
  ModelDeleteDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="model-delete-dialog" /> : null,
}));
vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
    i18n: { resolvedLanguage: "en" },
  }),
}));

const registry = {
  metadata: { name: "team-models" },
  visibility: "private",
} as ModelRegistry;

const renderDrawer = (value: ModelRegistry = registry) =>
  render(
    <TooltipProvider>
      <ModelDetailDrawer
        workspace="default"
        registry={value}
        selection={{ model: "org/model", version: "requested-revision" }}
        open
        onOpenChange={vi.fn()}
      />
    </TooltipProvider>,
  );

beforeEach(() => {
  go.mockReset();
  vi.mocked(useRegistryModelVersion).mockReturnValue({
    model: {
      name: "resolved-revision",
      alias: "production-model",
      size: "54.8 GB",
      creation_time: "2026-08-24T14:08:37Z",
      labels: {},
      info: { parameter_count: "27.8B" },
    },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useRegistryModelVersion>);
});

describe("ModelDetailDrawer", () => {
  it("uses the registry as context and frames the model document", () => {
    renderDrawer();

    expect(screen.getByText("team-models")).toBeDefined();
    expect(screen.getByRole("heading", { name: "org/model" })).toBeDefined();
    expect(screen.getByText("resolved-revision")).toBeDefined();
    expect(screen.getByText("54.8 GB")).toBeDefined();
    expect(screen.queryByText("common.sections.basicInformation")).toBeNull();
    expect(screen.getByTestId("model-readme").dataset.framed).toBe("true");
  });

  it("opens endpoint creation with the exact registry model reference", () => {
    renderDrawer();

    fireEvent.click(screen.getByTestId("model-deploy"));

    expect(go).toHaveBeenCalledWith({
      to: "/default/endpoints/create",
      query: {
        model_registry: "team-models",
        model: "org/model",
        version: "resolved-revision",
      },
      type: "push",
    });
  });

  it("omits alias for a public registry", () => {
    renderDrawer({ ...registry, visibility: "public" });

    expect(
      screen.queryByText("model_registries.models.fields.alias"),
    ).toBeNull();
    expect(screen.queryByText("production-model")).toBeNull();
  });

  it("keeps writable management actions in the overflow menu", async () => {
    renderDrawer();

    fireEvent.pointerDown(screen.getByTestId("model-actions-trigger"), {
      button: 0,
      ctrlKey: false,
    });
    fireEvent.click(
      await screen.findByText("model_registries.models.actions.edit"),
    );

    expect(screen.getByTestId("model-edit-dialog")).toBeDefined();
  });
});
