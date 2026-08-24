import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ModelRegistryWriteActions } from "@/domains/model-registry/components/ModelRegistryWriteActions";
import type { ModelRegistry } from "@/domains/model-registry/types";

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@refinedev/core", async () => {
  const actual =
    await vi.importActual<typeof import("@refinedev/core")>("@refinedev/core");
  return {
    ...actual,
    useNavigation: () => ({ editUrl: () => "/edit" }),
    useResource: () => ({ resource: { name: "model_registries" } }),
  };
});

const registry = (annotations: Record<string, string>): ModelRegistry =>
  ({
    id: 1,
    api_version: "v1",
    kind: "ModelRegistry",
    metadata: {
      name: "public-model-scope",
      workspace: "default",
      deletion_timestamp: null,
      creation_timestamp: "2026-01-01T00:00:00Z",
      update_timestamp: "2026-01-01T00:00:00Z",
      labels: {},
      annotations,
    },
    spec: { type: "model-scope", url: "https://www.modelscope.cn" },
    status: { phase: "Connected" },
  }) as unknown as ModelRegistry;

describe("ModelRegistryWriteActions", () => {
  it("offers no write entry point on a registry the control plane provisions", () => {
    render(
      <ModelRegistryWriteActions
        registry={registry({ "neutree.ai/builtin": "true" })}
      />,
    );

    // Not "the menu opens and its items are disabled" — there is no menu. The
    // acceptance for a registry the API refuses to write is that nothing leads
    // to the attempt.
    expect(screen.queryByTestId("row-actions-trigger")).toBeNull();
  });

  it("offers edit and delete on a registry a user created", () => {
    render(<ModelRegistryWriteActions registry={registry({})} />);

    const trigger = screen.getByTestId("row-actions-trigger");
    fireEvent.click(trigger);

    expect(screen.getByText("buttons.edit")).toBeTruthy();
    expect(screen.getByText("buttons.delete")).toBeTruthy();
  });

  it("reads the annotation, not the registry's name or kind", () => {
    // The provisioned registries are a public hub under a reserved name, which
    // is exactly what a user's own registry can also look like.
    render(
      <ModelRegistryWriteActions
        registry={registry({ "neutree.ai/builtin": "false" })}
      />,
    );

    expect(screen.getByTestId("row-actions-trigger")).toBeTruthy();
  });
});
