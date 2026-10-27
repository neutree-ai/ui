import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ModelRegistryWriteActions } from "@/domains/model-registry/components/ModelRegistryWriteActions";
import type { ModelRegistry } from "@/domains/model-registry/types";
import { openMenu } from "@/foundation/testing/interactions";

// Reaching the row-action parts means importing the table module, which pulls in
// @refinedev/react-table — whose ESM build imports `lodash/isEqual` with no
// extension and fails to resolve under vitest. Nothing here renders a table, so
// the hook it exports is never called.
vi.mock("@refinedev/react-table", () => ({ useTable: vi.fn() }));

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

    openMenu(screen.getByTestId("row-actions-trigger"));

    screen.getByText("buttons.edit");
    screen.getByText("buttons.delete");
  });
});
