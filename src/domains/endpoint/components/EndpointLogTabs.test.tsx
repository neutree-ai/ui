import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Endpoint } from "@/domains/endpoint/types";
import { EndpointLogTabs } from "./EndpointLogTabs";

const logSources = vi.hoisted(() => ({
  deployments: [] as Array<{
    name: string;
    replicas: Array<{
      replica_id: string;
      logs: Array<{ type: string; url: string; download_url: string }>;
    }>;
  }>,
}));

vi.mock(
  "@/domains/endpoint/hooks/use-endpoint-log-sources",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("@/domains/endpoint/hooks/use-endpoint-log-sources")
      >();
    return {
      ...actual,
      useEndpointLogSources: () => ({
        deployments: logSources.deployments,
        isLoading: false,
        refetch: vi.fn(),
      }),
    };
  },
);

vi.mock("@/domains/endpoint/hooks/use-streaming-logs", () => ({
  useStreamingLogs: () => ({
    logs: "log line",
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("./LogViewer", () => ({
  LogViewer: ({ source }: { source: string }) => (
    <div data-testid="endpoint-log-viewer">{source}</div>
  ),
}));

const endpoint = {
  metadata: { workspace: "default", name: "qwen" },
} as Endpoint;

const makeDeployment = (replicaCount: number, logTypes: string[]) => ({
  name: "Backend",
  replicas: Array.from({ length: replicaCount }, (_, index) => ({
    replica_id: `replica-${index}`,
    logs: logTypes.map((type) => ({
      type,
      url: `/endpoints/default/qwen/logs/replica-${index}/${type}`,
      download_url: `/endpoints/default/qwen/logs/replica-${index}/${type}/download`,
    })),
  })),
});

describe("EndpointLogTabs toolbar", () => {
  beforeEach(() => {
    logSources.deployments = [];
  });

  it("removes the toolbar when there is nothing to switch", () => {
    logSources.deployments = [makeDeployment(1, ["logs"])];

    render(<EndpointLogTabs endpoint={endpoint} />);

    expect(screen.queryByTestId("endpoint-log-toolbar")).toBeNull();
    expect(screen.getByTestId("endpoint-log-viewer")).toBeTruthy();
  });

  it("keeps the toolbar when log types can be switched", () => {
    logSources.deployments = [makeDeployment(1, ["logs", "stderr"])];

    render(<EndpointLogTabs endpoint={endpoint} />);

    expect(screen.getByTestId("endpoint-log-toolbar")).toBeTruthy();
    expect(
      screen.getByRole("group", { name: "common.tabs.logs" }),
    ).toBeTruthy();
  });

  it("keeps the toolbar when replicas can be switched", () => {
    logSources.deployments = [makeDeployment(2, ["logs"])];

    render(<EndpointLogTabs endpoint={endpoint} />);

    expect(screen.getByTestId("endpoint-log-toolbar")).toBeTruthy();
    expect(screen.getByRole("combobox")).toBeTruthy();
  });
});
