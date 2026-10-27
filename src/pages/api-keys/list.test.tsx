import { render, screen, within } from "@testing-library/react";
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

  return { key, project };
});

vi.mock("@refinedev/core", () => ({
  useCustomMutation: () => ({ mutateAsync: vi.fn() }),
  useDelete: () => ({ mutateAsync: vi.fn() }),
  useInvalidate: () => vi.fn(),
  useList: () => ({ data: { data: [fixture.key] } }),
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
        total_projects: 1,
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

vi.mock("@/foundation/components/DeleteConfirmDialog", () => ({
  DeleteConfirmDialog: () => null,
}));

vi.mock("@/foundation/components/ListPage", () => ({
  ListPage: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/foundation/components/ShowButton", () => ({
  ShowButton: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/foundation/components/Timestamp", () => ({
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
