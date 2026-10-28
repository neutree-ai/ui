import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ModelDetailDrawer } from "@/domains/model-registry/components/ModelDetailDrawer";
import type { ModelRegistry } from "@/domains/model-registry/types";
import { useRegistryModelVersion } from "@/foundation/hooks/use-registry-model-version";
import { openMenu } from "@/foundation/testing/interactions";

const go = vi.fn();

vi.mock("@refinedev/core", () => ({ useGo: () => go }));
vi.mock("@/foundation/hooks/use-registry-model-version", () => ({
  useRegistryModelVersion: vi.fn(),
}));
vi.mock("@/domains/model-registry/components/ModelReadme", () => ({
  ModelReadme: () => <div data-testid="model-readme" />,
}));
vi.mock("@/domains/model-registry/components/ModelEditDialog", () => ({
  ModelEditDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="model-edit-dialog" /> : null,
}));
vi.mock("@/domains/model-registry/components/ModelDeleteDialog", () => ({
  ModelDeleteDialog: ({
    open,
    onDeleted,
  }: {
    open: boolean;
    onDeleted: () => void;
  }) =>
    open ? (
      <button
        type="button"
        data-testid="model-delete-dialog"
        onClick={onDeleted}
      >
        Confirm delete
      </button>
    ) : null,
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

const renderDrawer = (
  value: ModelRegistry = registry,
  onOpenChange = vi.fn(),
) =>
  render(
    <TooltipProvider>
      <ModelDetailDrawer
        workspace="default"
        registry={value}
        selection={{ model: "org/model", version: "requested-revision" }}
        open
        onOpenChange={onOpenChange}
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
  it("shows the registry as context and the resolved version's summary", () => {
    renderDrawer();

    screen.getByText("team-models");
    screen.getByRole("heading", { name: "org/model" });
    screen.getByText("resolved-revision");
    screen.getByText("54.8 GB");
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

    openMenu(screen.getByTestId("model-actions-trigger"));
    fireEvent.click(
      await screen.findByText("model_registries.models.actions.edit"),
    );

    screen.getByTestId("model-edit-dialog");
  });

  it("closes the drawer once the model is deleted from its menu", async () => {
    const onOpenChange = vi.fn();
    renderDrawer(registry, onOpenChange);

    openMenu(screen.getByTestId("model-actions-trigger"));
    fireEvent.click(await screen.findByText("buttons.delete"));

    fireEvent.click(screen.getByTestId("model-delete-dialog"));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows a loading state while the model is being fetched", () => {
    vi.mocked(useRegistryModelVersion).mockReturnValue({
      model: null,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useRegistryModelVersion>);

    const { container } = renderDrawer();

    expect(container.querySelector("[data-testid='model-deploy']")).toBeNull();
    screen.getByTitle("Loading...");
  });

  it("shows an error and retries the model request", () => {
    const refetch = vi.fn();
    vi.mocked(useRegistryModelVersion).mockReturnValue({
      model: null,
      isLoading: false,
      error: { message: "Registry unavailable" },
      refetch,
    } as unknown as ReturnType<typeof useRegistryModelVersion>);

    renderDrawer();
    expect(screen.getByTestId("model-detail-error").textContent).toContain(
      "Registry unavailable",
    );

    fireEvent.click(screen.getByText("buttons.refresh"));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("renders unknown summary values when optional metadata is absent", () => {
    vi.mocked(useRegistryModelVersion).mockReturnValue({
      model: {
        name: "resolved-revision",
        alias: "",
        labels: {},
        info: {},
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useRegistryModelVersion>);

    renderDrawer({ ...registry, visibility: undefined });

    screen.getByText("-");
    expect(
      screen.getByText("model_registries.fields.visibility").parentElement
        ?.textContent,
    ).toContain("model_registries.models.values.unknown");
    expect(
      screen.getByText("common.fields.createdAt").parentElement?.textContent,
    ).toContain("model_registries.models.values.unknown");
  });
});
