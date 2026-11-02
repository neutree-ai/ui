import { useList } from "@refinedev/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStreamingLogs } from "@/domains/endpoint/hooks/use-streaming-logs";
import type { Endpoint } from "@/domains/endpoint/types";
import { EndpointLogTabs } from "./EndpointLogTabs";

const logSources = vi.hoisted(() => ({
  isLoading: false,
  refetch: vi.fn(),
  deployments: [] as Array<{
    name: string;
    replicas: Array<{
      replica_id: string;
      logs: Array<{
        type: string;
        url: string;
        download_url: string;
        container_name?: string;
        restart_count?: number;
        started?: boolean;
      }>;
    }>;
  }>,
}));

const engineRegistry = vi.hoisted(() => ({
  names: ["vllm", "sglang", "custom-engine"],
}));

vi.mock("@refinedev/core", () => ({
  useList: vi.fn(() => ({
    data: {
      data: engineRegistry.names.map((name) => ({ metadata: { name } })),
    },
  })),
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
        isLoading: logSources.isLoading,
        refetch: logSources.refetch,
      }),
    };
  },
);

vi.mock("@/domains/endpoint/hooks/use-streaming-logs", () => ({
  useStreamingLogs: vi.fn(),
}));

vi.mock("./LogViewer", () => ({
  LogViewer: ({
    source,
    downloadUrl,
    isLoading,
    onRefresh,
  }: {
    source: string;
    downloadUrl?: string;
    isLoading?: boolean;
    onRefresh?: () => void;
  }) => (
    <div
      data-testid="endpoint-log-viewer"
      data-download-url={downloadUrl}
      data-loading={String(!!isLoading)}
    >
      {source}
      <button type="button" onClick={onRefresh}>
        refresh
      </button>
    </div>
  ),
}));

const endpoint = {
  metadata: { workspace: "default", name: "qwen" },
  spec: { engine: { engine: "vllm", version: "test" } },
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

const makeKubernetesDeployment = (
  containers: Array<{
    container_name: string;
    restart_count?: number;
    started?: boolean;
  }> = [
    { container_name: "engine", restart_count: 2 },
    { container_name: "sidecar" },
    { container_name: "init-model", restart_count: 1 },
  ],
) => ({
  name: "Backend",
  replicas: ["pod-a", "pod-b"].map((replicaId) => ({
    replica_id: replicaId,
    logs: containers.map((container) => ({
      ...container,
      type: "logs",
      url: `/api/v1/logs/${replicaId}/logs?container=${container.container_name}`,
      download_url: `/api/v1/logs/${replicaId}/logs?container=${container.container_name}&download=true`,
    })),
  })),
});

const makeInferenceDeployment = (started = false, engineName = "vllm") =>
  makeKubernetesDeployment([
    { container_name: "sidecar" },
    {
      container_name: "model-downloader",
      restart_count: 1,
      started: true,
    },
    { container_name: engineName, ...(started ? { started } : {}) },
  ]);

function selectLogOption(label: string, option: string) {
  fireEvent.click(screen.getByRole("combobox", { name: label }));
  fireEvent.click(screen.getByRole("option", { name: option }));
}

function expectLogSource(pod: string, container: string, previous = false) {
  const calls = vi.mocked(useStreamingLogs).mock.calls;
  const [url, enabled] = calls[calls.length - 1];
  expect(enabled).toBe(true);
  const view = new URL(url!, "http://localhost");
  const download = new URL(
    screen
      .getByTestId("endpoint-log-viewer")
      .getAttribute("data-download-url")!,
    "http://localhost",
  );
  expect(view.pathname).toBe(`/logs/${pod}/logs`);
  expect(download.pathname).toBe(`/api/v1/logs/${pod}/logs`);
  for (const parsed of [view, download]) {
    expect(parsed.searchParams.getAll("container")).toEqual([container]);
    expect(parsed.searchParams.get("previous")).toBe(previous ? "true" : null);
  }
  expect(view.searchParams.getAll("lines")).toEqual(["1000"]);
  expect(download.searchParams.get("download")).toBe("true");
}

beforeEach(() => {
  logSources.deployments = [];
  logSources.isLoading = false;
  logSources.refetch.mockReset();
  engineRegistry.names = ["vllm", "sglang", "custom-engine"];
  vi.mocked(useStreamingLogs).mockReset().mockReturnValue({
    logs: "log line",
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  });
});

describe("EndpointLogTabs toolbar", () => {
  it("removes the toolbar when there is nothing to switch", () => {
    logSources.deployments = [makeDeployment(1, ["logs"])];

    render(<EndpointLogTabs endpoint={endpoint} clusterType="ssh" />);

    expect(screen.queryByTestId("endpoint-log-toolbar")).toBeNull();
    screen.getByTestId("endpoint-log-viewer");
  });

  it("keeps the toolbar when log types can be switched", () => {
    logSources.deployments = [makeDeployment(1, ["logs", "stderr"])];

    render(<EndpointLogTabs endpoint={endpoint} clusterType="ssh" />);

    screen.getByTestId("endpoint-log-toolbar");
    screen.getByRole("group", { name: "common.tabs.logs" });
  });

  it("keeps the toolbar when replicas can be switched", () => {
    logSources.deployments = [makeDeployment(2, ["logs"])];

    render(<EndpointLogTabs endpoint={endpoint} clusterType="ssh" />);

    screen.getByTestId("endpoint-log-toolbar");
    screen.getByRole("combobox");
  });

  it("switches the active replica", () => {
    logSources.deployments = [makeDeployment(2, ["logs"])];

    render(<EndpointLogTabs endpoint={endpoint} clusterType="ssh" />);

    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: "replica-1" }));

    expect(screen.getByRole("combobox").textContent).toContain("replica-1");
  });
});

describe("Kubernetes log sources", () => {
  beforeEach(() => {
    logSources.deployments = [makeKubernetesDeployment()];
  });

  it("waits for the actual cluster type before showing container controls", () => {
    const { rerender } = render(
      <EndpointLogTabs endpoint={endpoint} clusterType={undefined} />,
    );

    expect(
      screen.queryByRole("combobox", { name: "endpoints.logs.container" }),
    ).toBeNull();

    rerender(<EndpointLogTabs endpoint={endpoint} clusterType="kubernetes" />);

    screen.getByRole("combobox", { name: "endpoints.logs.container" });
    expectLogSource("pod-a", "engine");
  });

  it("scopes engine lookup to the endpoint workspace", () => {
    const scopedEndpoint = {
      ...endpoint,
      metadata: { ...endpoint.metadata, workspace: "team-a" },
    };
    render(
      <EndpointLogTabs endpoint={scopedEndpoint} clusterType="kubernetes" />,
    );

    expect(useList).toHaveBeenLastCalledWith(
      expect.objectContaining({
        resource: "engines",
        meta: expect.objectContaining({
          workspaced: true,
          workspace: scopedEndpoint.metadata.workspace,
        }),
      }),
    );
  });

  it("keeps Replica and Container selectors with a flat container list", () => {
    const deployment = makeKubernetesDeployment();
    logSources.deployments = [
      { ...deployment, replicas: deployment.replicas.slice(0, 1) },
    ];
    render(<EndpointLogTabs endpoint={endpoint} clusterType="kubernetes" />);

    const selectors = screen.getAllByRole("combobox");
    expect(selectors).toHaveLength(2);
    expect(selectors[0].getAttribute("aria-label")).toBe(
      "common.fields.replica",
    );
    expect(selectors[1].getAttribute("aria-label")).toBe(
      "endpoints.logs.container",
    );
    expectLogSource("pod-a", "engine");

    fireEvent.click(
      screen.getByRole("combobox", { name: "endpoints.logs.container" }),
    );
    expect(
      screen.getAllByRole("option").map((option) => option.textContent),
    ).toEqual(["engine", "sidecar", "init-model"]);
  });

  it("maps registered engines to inference without changing request names", () => {
    const engineName = "custom-engine";
    logSources.deployments = [makeInferenceDeployment(true, engineName)];
    render(<EndpointLogTabs endpoint={endpoint} clusterType="kubernetes" />);

    expectLogSource("pod-a", engineName);
    fireEvent.click(
      screen.getByRole("combobox", { name: "endpoints.logs.container" }),
    );
    expect(
      screen.getAllByRole("option").map((option) => option.textContent),
    ).toEqual([
      "sidecar",
      "endpoints.logs.modelDownloader",
      "endpoints.logs.inference",
    ]);
    fireEvent.click(
      screen.getByRole("option", { name: "endpoints.logs.modelDownloader" }),
    );
    expectLogSource("pod-a", "model-downloader");
    fireEvent.click(
      screen.getByRole("button", { name: "endpoints.logs.previous" }),
    );
    expectLogSource("pod-a", "model-downloader", true);
  });

  it.each(["current", "previous"])(
    "preserves %s logs until the page is reopened when inference starts",
    (run) => {
      logSources.deployments = [makeInferenceDeployment()];
      const { rerender, unmount } = render(
        <EndpointLogTabs endpoint={endpoint} clusterType="kubernetes" />,
      );
      expectLogSource("pod-a", "model-downloader");
      if (run === "previous") {
        fireEvent.click(
          screen.getByRole("button", { name: "endpoints.logs.previous" }),
        );
      }
      logSources.deployments = [makeInferenceDeployment(true)];
      rerender(
        <EndpointLogTabs endpoint={endpoint} clusterType="kubernetes" />,
      );
      expectLogSource("pod-a", "model-downloader", run === "previous");

      unmount();
      render(<EndpointLogTabs endpoint={endpoint} clusterType="kubernetes" />);
      expectLogSource("pod-a", "vllm");
    },
  );

  it("keeps a same-name container across Pod changes but resets previous", () => {
    const deployment = makeKubernetesDeployment();
    logSources.deployments = [
      {
        ...deployment,
        replicas: deployment.replicas.map((replica) => ({
          ...replica,
          logs: replica.logs.map((log) => ({
            ...log,
            restart_count:
              replica.replica_id === "pod-b" ? 0 : log.restart_count,
          })),
        })),
      },
    ];
    render(<EndpointLogTabs endpoint={endpoint} clusterType="kubernetes" />);
    selectLogOption("endpoints.logs.container", "init-model");
    fireEvent.click(
      screen.getByRole("button", { name: "endpoints.logs.previous" }),
    );
    expectLogSource("pod-a", "init-model", true);

    selectLogOption("common.fields.replica", "pod-b");

    expectLogSource("pod-b", "init-model");
    expect(screen.queryByLabelText("endpoints.logs.containerRun")).toBeNull();
  });

  it("resets previous on Container changes and uses only its own restart count", () => {
    render(<EndpointLogTabs endpoint={endpoint} clusterType="kubernetes" />);
    fireEvent.click(
      screen.getByRole("button", { name: "endpoints.logs.previous" }),
    );
    expectLogSource("pod-a", "engine", true);
    selectLogOption("endpoints.logs.container", "sidecar");

    expectLogSource("pod-a", "sidecar");
    expect(screen.queryByLabelText("endpoints.logs.containerRun")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "endpoints.logs.previous" }),
    ).toBeNull();

    selectLogOption("endpoints.logs.container", "engine");
    expectLogSource("pod-a", "engine");
    screen.getByRole("button", { name: "endpoints.logs.previous" });
  });

  it.each(["engine", "init-model"])(
    "keeps %s current logs implicit until restart history appears",
    (containerName) => {
      const deployment = makeKubernetesDeployment();
      logSources.deployments = [
        {
          ...deployment,
          replicas: deployment.replicas.map((replica) => ({
            ...replica,
            logs: replica.logs
              .filter((log) => log.container_name === containerName)
              .map((log) => ({ ...log, restart_count: 0 })),
          })),
        },
      ];
      const { rerender } = render(
        <EndpointLogTabs endpoint={endpoint} clusterType="kubernetes" />,
      );

      expectLogSource("pod-a", containerName);
      expect(screen.queryByLabelText("endpoints.logs.containerRun")).toBeNull();
      expect(
        screen.queryByRole("button", { name: "endpoints.logs.previous" }),
      ).toBeNull();

      logSources.deployments = [deployment];
      rerender(
        <EndpointLogTabs endpoint={endpoint} clusterType="kubernetes" />,
      );
      expectLogSource("pod-a", containerName);
      screen.getByLabelText("endpoints.logs.containerRun");
      screen.getByText("endpoints.logs.current");
      screen.getByText("endpoints.logs.previous");
    },
  );

  it("shows loading and refreshes both metadata and the selected stream", () => {
    const refetch = vi.fn();
    vi.mocked(useStreamingLogs).mockReturnValue({
      logs: "",
      isLoading: true,
      error: null,
      refetch,
    });
    const { rerender } = render(
      <EndpointLogTabs endpoint={endpoint} clusterType="kubernetes" />,
    );
    expect(
      screen.getByTestId("endpoint-log-viewer").getAttribute("data-loading"),
    ).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "refresh" }));
    expect(logSources.refetch).toHaveBeenCalledOnce();
    expect(refetch).toHaveBeenCalledOnce();

    logSources.isLoading = true;
    rerender(<EndpointLogTabs endpoint={endpoint} clusterType="kubernetes" />);
    screen.getByText("loading");
  });
});

describe("Ray log compatibility", () => {
  it("defaults to application, preserves stderr selection and downloads the same stream", () => {
    logSources.deployments = [
      makeDeployment(2, ["stderr", "stdout", "application"]),
    ];
    render(<EndpointLogTabs endpoint={endpoint} clusterType="ssh" />);
    expect(useStreamingLogs).toHaveBeenLastCalledWith(
      "/endpoints/default/qwen/logs/replica-0/application?lines=1000",
      true,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "endpoints.logs.stderr" }),
    );
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: "replica-1" }));

    expect(useStreamingLogs).toHaveBeenLastCalledWith(
      "/endpoints/default/qwen/logs/replica-1/stderr?lines=1000",
      true,
    );
    expect(
      screen
        .getByTestId("endpoint-log-viewer")
        .getAttribute("data-download-url"),
    ).toBe("/endpoints/default/qwen/logs/replica-1/stderr/download");
    expect(
      screen.queryByRole("button", { name: "endpoints.logs.previous" }),
    ).toBeNull();
  });

  it("defaults to stderr for failed replicas without application logs", () => {
    logSources.deployments = [makeDeployment(1, ["stderr", "stdout"])];
    render(<EndpointLogTabs endpoint={endpoint} clusterType="ssh" />);

    expect(useStreamingLogs).toHaveBeenLastCalledWith(
      "/endpoints/default/qwen/logs/replica-0/stderr?lines=1000",
      true,
    );
    screen.getByTestId("endpoint-log-viewer");
  });
});
