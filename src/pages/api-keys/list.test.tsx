import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ApiKey, ApiKeyProject } from "@/domains/api-key/types";

const fixture = vi.hoisted(() => {
  const key = {
    id: "key-empty-states",
    api_version: "v1",
    kind: "ApiKey",
    metadata: {
      name: "empty-states-key",
      display_name: "Empty states key",
      workspace: null,
      deletion_timestamp: null,
      creation_timestamp: "2026-01-01T00:00:00Z",
      update_timestamp: "2026-01-01T00:00:00Z",
      labels: {},
      annotations: {},
    },
    spec: {
      quota: 0,
      description: "",
      limits: {},
    },
    status: {
      phase: "Created",
      last_transition_time: "2026-01-01T00:00:00Z",
      error_message: null,
      sk_value: null,
      usage: null,
      last_used_at: null,
      last_sync_at: null,
    },
  } as ApiKey;

  const project = {
    id: "ungrouped-design-lab",
    api_version: "v1",
    kind: "ApiKeyProject",
    metadata: { name: "Ungrouped", workspace: "design-lab" },
    spec: { description: "" },
    user_id: "user-paula",
    is_ungrouped: true,
  } as ApiKeyProject;

  const movingKey = {
    ...key,
    id: "key-moving",
    metadata: {
      ...key.metadata,
      name: "moving-key",
      display_name: "Moving key",
      workspace: "design-lab",
    },
    spec: { ...key.spec, project_id: "project-billing" },
  } as ApiKey;

  const billing = {
    ...project,
    id: "project-billing",
    metadata: { name: "billing", workspace: "design-lab" },
    is_ungrouped: false,
  } as ApiKeyProject;

  const mutateAsync = vi.fn(async () => ({ data: 1 }));

  return { key, project, movingKey, billing, mutateAsync };
});

vi.mock("@refinedev/core", () => ({
  useCustomMutation: () => ({ mutateAsync: fixture.mutateAsync }),
  useDelete: () => ({ mutateAsync: vi.fn() }),
  useInvalidate: () => vi.fn(),
  useList: () => ({ data: { data: [fixture.key, fixture.movingKey] } }),
  useNavigation: () => ({ show: vi.fn() }),
  useNotification: () => ({ open: vi.fn() }),
}));

vi.mock("@/domains/api-key/hooks/use-api-key-project-groups", () => ({
  useApiKeyProjectGroups: () => ({
    data: [
      {
        project: fixture.project,
        api_keys: [fixture.key],
        api_key_count: 1,
        current_usage: 0,
        total_projects: 2,
      },
      {
        project: fixture.billing,
        api_keys: [fixture.movingKey],
        api_key_count: 1,
        current_usage: 0,
        total_projects: 2,
      },
    ],
    totalApiKeys: 1,
    isLoading: false,
    error: "",
    refetch: vi.fn(),
  }),
}));

vi.mock("@/domains/api-key/hooks/use-api-key-projects", () => ({
  useApiKeyProjects: () => ({ data: [] }),
}));

vi.mock("@/domains/api-key/hooks/use-api-key-policy", async () => {
  const actual = await vi.importActual<
    typeof import("@/domains/api-key/hooks/use-api-key-policy")
  >("@/domains/api-key/hooks/use-api-key-policy");
  return {
    ...actual,
    useAllApiKeyTraffic: () => new Map(),
    useAllApiKeyUsage: () => new Map(),
    useApiKeyDisable: () => ({ disable: vi.fn(), enable: vi.fn() }),
    useWorkspaceModelMap: () => new Map(),
  };
});

vi.mock("@/foundation/hooks/use-workspace", () => ({
  ALL_WORKSPACES: "_all_",
  useWorkspace: () => ({ current: "design-lab", isLoading: false }),
}));

vi.mock("@/domains/api-key/components/ApiKeyRankingOverview", () => ({
  ApiKeyRankingOverview: () => null,
}));

vi.mock("@/domains/api-key/components/CreateApiKeyForm", () => ({
  CreateApiKeyForm: () => null,
}));

vi.mock("@/domains/api-key/components/ProjectPicker", () => ({
  ProjectPicker: () => null,
}));

vi.mock("@/foundation/scene/DeleteConfirmDialog", () => ({
  DeleteConfirmDialog: () => null,
}));

vi.mock("@/foundation/scene/ListPage", () => ({
  ListPage: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/foundation/scene/ShowButton", () => ({
  ShowButton: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/foundation/role/Timestamp", () => ({
  default: () => null,
}));

import { ApiKeysList } from "./list";

describe("ApiKeysList empty states", () => {
  it("uses shared placeholders for missing Workspace and Usage while showing Unlimited limits", () => {
    render(<ApiKeysList />);

    const row = within(screen.getByRole("row", { name: /Empty states key/ }));
    expect(row.getAllByTestId("empty-value")).toHaveLength(2);
    row.getByText("api_keys.limits.unlimited");
  });
});

describe("ApiKeysList move", () => {
  it("opens the folded target group once the move succeeds", async () => {
    render(<ApiKeysList />);

    fireEvent.click(
      screen.getByRole("button", { name: /api_keys.projects.ungrouped/ }),
    );
    expect(screen.queryByRole("row", { name: /Empty states key/ })).toBeNull();

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "api_keys.selection.selectAllInProject:billing",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "api_keys.move.action" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "api_keys.move.confirm" }),
    );

    await screen.findByRole("row", { name: /Empty states key/ });
  });
});
