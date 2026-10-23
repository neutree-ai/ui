import { useList } from "@refinedev/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
      logs: Array<{ type: string; url: string; download_url: string }>;
      containers?: Array<{
        name: string;
        type: "container" | "initContainer";
        restart_count: number;
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

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("./LogViewer", () => ({
  LogViewer: ({
    source,
    downloadUrl,
    onRefresh,
  }: {
    source: string;
    downloadUrl?: string;
    onRefresh?: () => void;
  }) => (
    <div data-testid="endpoint-log-viewer" data-download-url={downloadUrl}>
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

const makeKubernetesDeployment = () => ({
  name: "Backend",
  replicas: ["pod-a", "pod-b", "pod-c"].map((replicaId) => ({
    replica_id: replicaId,
    logs: [
      {
        type: "logs",
        url: `/api/v1/logs/${replicaId}/logs?tail=true`,
        download_url: `/api/v1/logs/${replicaId}/logs?download=true&tail=true`,
      },
    ],
    containers: [
      {
        name: replicaId === "pod-c" ? "replacement" : "engine",
        type: "container" as const,
        restart_count: 2,
      },
      { name: "sidecar", type: "container" as const, restart_count: 0 },
      { name: "init-model", type: "initContainer" as const, restart_count: 1 },
    ],
  })),
});

const makeInferenceDeployment = (started = false, engineName = "vllm") => ({
  ...makeKubernetesDeployment(),
  replicas: makeKubernetesDeployment().replicas.map((replica) => ({
    ...replica,
    containers: [
      { name: "sidecar", type: "container" as const, restart_count: 0 },
      {
        name: "model-downloader",
        type: "initContainer" as const,
        restart_count: 1,
        started: true,
      },
      {
        name: engineName,
        type: "container" as const,
        restart_count: 0,
        started,
      },
    ],
  })),
});

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
    expect(parsed.searchParams.get("container")).toBe(container);
    expect(parsed.searchParams.get("previous")).toBe(previous ? "true" : null);
    expect(parsed.searchParams.get("tail")).toBe("true");
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
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(cleanup);

describe("EndpointLogTabs toolbar", () => {
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

  it("switches the active replica", () => {
    logSources.deployments = [makeDeployment(2, ["logs"])];

    render(<EndpointLogTabs endpoint={endpoint} />);

    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: "replica-1" }));

    expect(screen.getByRole("combobox").textContent).toContain("replica-1");
  });
});

describe("Kubernetes log sources", () => {
  beforeEach(() => {
    logSources.deployments = [makeKubernetesDeployment()];
  });

  it("keeps Replica and Container selectors with a flat container list", () => {
    render(<EndpointLogTabs endpoint={endpoint} />);

    const selectors = screen.getAllByRole("combobox");
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
    expect(screen.queryByRole("group")).toBeNull();
    expect(screen.queryByText("endpoints.logs.containers")).toBeNull();
    expect(screen.queryByText("endpoints.logs.initContainers")).toBeNull();
  });

  it.each(["vllm", "sglang", "custom-engine"])(
    "maps registered engine %s to inference without changing request names",
    (engineName) => {
      logSources.deployments = [makeInferenceDeployment(true, engineName)];
      render(<EndpointLogTabs endpoint={endpoint} />);

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
    },
  );

  it.each([false, true])(
    "keeps the initial downloader when inference starts after refresh=%s",
    (refresh) => {
      logSources.deployments = [makeInferenceDeployment()];
      const { rerender } = render(<EndpointLogTabs endpoint={endpoint} />);
      expectLogSource("pod-a", "model-downloader");

      if (refresh) {
        fireEvent.click(screen.getByRole("button", { name: "refresh" }));
      }
      logSources.deployments = [makeInferenceDeployment(true)];
      rerender(<EndpointLogTabs endpoint={endpoint} />);
      expectLogSource("pod-a", "model-downloader");
    },
  );

  it("keeps the initial inference when its startup state changes", () => {
    logSources.deployments = [makeInferenceDeployment(true)];
    const { rerender } = render(<EndpointLogTabs endpoint={endpoint} />);
    expectLogSource("pod-a", "vllm");

    logSources.deployments = [makeInferenceDeployment()];
    rerender(<EndpointLogTabs endpoint={endpoint} />);
    expectLogSource("pod-a", "vllm");
  });

  it("does not change containers when the engine registry refreshes", () => {
    engineRegistry.names = [];
    logSources.deployments = [makeInferenceDeployment(true)];
    const { rerender } = render(<EndpointLogTabs endpoint={endpoint} />);
    expectLogSource("pod-a", "model-downloader");

    engineRegistry.names = ["vllm"];
    rerender(<EndpointLogTabs endpoint={endpoint} />);
    expectLogSource("pod-a", "model-downloader");
  });

  it("reevaluates the initial container only when the page is reopened", () => {
    logSources.deployments = [makeInferenceDeployment()];
    const { rerender, unmount } = render(
      <EndpointLogTabs endpoint={endpoint} />,
    );
    logSources.deployments = [makeInferenceDeployment(true)];
    rerender(<EndpointLogTabs endpoint={endpoint} />);
    expectLogSource("pod-a", "model-downloader");

    unmount();
    render(<EndpointLogTabs endpoint={endpoint} />);
    expectLogSource("pod-a", "vllm");
  });

  it("does not override a manually selected downloader when inference starts", () => {
    logSources.deployments = [makeInferenceDeployment()];
    const { rerender } = render(<EndpointLogTabs endpoint={endpoint} />);
    selectLogOption("endpoints.logs.container", "sidecar");
    selectLogOption(
      "endpoints.logs.container",
      "endpoints.logs.modelDownloader",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "endpoints.logs.previous" }),
    );

    logSources.deployments = [makeInferenceDeployment(true)];
    rerender(<EndpointLogTabs endpoint={endpoint} />);
    expectLogSource("pod-a", "model-downloader", true);
  });

  it.each(["pointer", "Enter", " "])(
    "preserves a same-value downloader selection confirmed with %j",
    (confirmation) => {
      logSources.deployments = [makeInferenceDeployment()];
      const { rerender } = render(<EndpointLogTabs endpoint={endpoint} />);
      fireEvent.click(
        screen.getByRole("combobox", { name: "endpoints.logs.container" }),
      );
      const option = screen.getByRole("option", {
        name: "endpoints.logs.modelDownloader",
      });
      if (confirmation === "pointer") {
        fireEvent.pointerDown(option, { button: 0, pointerType: "mouse" });
        fireEvent.pointerUp(option, { button: 0, pointerType: "mouse" });
      } else {
        fireEvent.keyDown(option, { key: confirmation });
      }

      logSources.deployments = [makeInferenceDeployment(true)];
      rerender(<EndpointLogTabs endpoint={endpoint} />);
      expectLogSource("pod-a", "model-downloader");
    },
  );

  it("keeps explicit LastContainer viewing on the downloader when inference starts", () => {
    logSources.deployments = [makeInferenceDeployment()];
    const { rerender } = render(<EndpointLogTabs endpoint={endpoint} />);
    fireEvent.click(
      screen.getByRole("button", { name: "endpoints.logs.previous" }),
    );

    logSources.deployments = [makeInferenceDeployment(true)];
    rerender(<EndpointLogTabs endpoint={endpoint} />);
    expectLogSource("pod-a", "model-downloader", true);
  });

  it("does not alias an engine that is absent from the registered engine list", () => {
    engineRegistry.names = [];
    logSources.deployments = [makeInferenceDeployment(true)];
    render(<EndpointLogTabs endpoint={endpoint} />);
    expectLogSource("pod-a", "model-downloader");
    selectLogOption("endpoints.logs.container", "vllm");
    expectLogSource("pod-a", "vllm");
  });

  it("keeps the initially selected container name across replica changes", () => {
    const deployment = makeInferenceDeployment(true);
    logSources.deployments = [
      {
        ...deployment,
        replicas: [
          deployment.replicas[0],
          makeInferenceDeployment().replicas[1],
        ],
      },
    ];
    render(<EndpointLogTabs endpoint={endpoint} />);
    expectLogSource("pod-a", "vllm");

    selectLogOption("common.fields.replica", "pod-b");
    expectLogSource("pod-b", "vllm");
  });

  it("keeps an unrecognized init container first instead of preferring its type", () => {
    const deployment = makeKubernetesDeployment();
    logSources.deployments = [
      {
        ...deployment,
        replicas: deployment.replicas.map((replica) => ({
          ...replica,
          containers: [
            replica.containers[2],
            ...replica.containers.slice(0, 2),
          ],
        })),
      },
    ];
    render(<EndpointLogTabs endpoint={endpoint} />);
    expectLogSource("pod-a", "init-model");
  });

  it("uses the endpoint engine while registry metadata is unavailable", () => {
    vi.mocked(useList).mockReturnValueOnce({ data: undefined } as ReturnType<
      typeof useList
    >);
    logSources.deployments = [makeInferenceDeployment(true)];
    render(<EndpointLogTabs endpoint={endpoint} />);
    expectLogSource("pod-a", "vllm");
  });

  it("shows Pod and Container selectors even for a single Pod", () => {
    const deployment = makeKubernetesDeployment();
    logSources.deployments = [
      { ...deployment, replicas: deployment.replicas.slice(0, 1) },
    ];
    render(<EndpointLogTabs endpoint={endpoint} />);

    expect(screen.getAllByRole("combobox")).toHaveLength(2);
    expect(
      screen
        .getByRole("button", { name: "endpoints.logs.current" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("keeps a same-name container across Pod changes but resets previous", () => {
    const deployment = makeKubernetesDeployment();
    logSources.deployments = [
      {
        ...deployment,
        replicas: deployment.replicas.map((replica) => ({
          ...replica,
          containers: replica.containers.map((container) => ({
            ...container,
            restart_count:
              replica.replica_id === "pod-b" ? 0 : container.restart_count,
          })),
        })),
      },
    ];
    render(<EndpointLogTabs endpoint={endpoint} />);
    selectLogOption("endpoints.logs.container", "init-model");
    fireEvent.click(
      screen.getByRole("button", { name: "endpoints.logs.previous" }),
    );
    expectLogSource("pod-a", "init-model", true);

    selectLogOption("common.fields.replica", "pod-b");

    expectLogSource("pod-b", "init-model");
    expect(screen.queryByLabelText("endpoints.logs.containerRun")).toBeNull();
  });

  it("falls back to a regular container when the new Pod has no matching name", () => {
    render(<EndpointLogTabs endpoint={endpoint} />);
    fireEvent.click(
      screen.getByRole("button", { name: "endpoints.logs.previous" }),
    );
    selectLogOption("common.fields.replica", "pod-c");

    expectLogSource("pod-c", "replacement");
  });

  it("resets previous on Container changes and uses only its own restart count", () => {
    render(<EndpointLogTabs endpoint={endpoint} />);
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
    expect(
      screen.getByRole("button", { name: "endpoints.logs.previous" }),
    ).toBeTruthy();
  });

  it("allows current logs for a completed init container without exit-state metadata", () => {
    render(<EndpointLogTabs endpoint={endpoint} />);
    selectLogOption("endpoints.logs.container", "init-model");

    expectLogSource("pod-a", "init-model");
    fireEvent.click(
      screen.getByRole("button", { name: "endpoints.logs.previous" }),
    );
    expectLogSource("pod-a", "init-model", true);
    fireEvent.click(
      screen.getByRole("button", { name: "endpoints.logs.current" }),
    );
    expectLogSource("pod-a", "init-model");
  });

  it("preserves selection and previous across metadata refreshes", () => {
    const { rerender } = render(<EndpointLogTabs endpoint={endpoint} />);
    selectLogOption("endpoints.logs.container", "init-model");
    fireEvent.click(
      screen.getByRole("button", { name: "endpoints.logs.previous" }),
    );
    logSources.deployments = [makeKubernetesDeployment()];
    rerender(<EndpointLogTabs endpoint={endpoint} />);

    expectLogSource("pod-a", "init-model", true);
  });

  it.each(["engine", "init-model"])(
    "resets %s to current when the selected Pod disappears or restart count drops",
    (containerName) => {
      const { rerender } = render(<EndpointLogTabs endpoint={endpoint} />);
      selectLogOption("endpoints.logs.container", containerName);
      selectLogOption("common.fields.replica", "pod-b");
      fireEvent.click(
        screen.getByRole("button", { name: "endpoints.logs.previous" }),
      );
      const deployment = makeKubernetesDeployment();
      logSources.deployments = [
        {
          ...deployment,
          replicas: deployment.replicas.filter(
            (replica) => replica.replica_id !== "pod-b",
          ),
        },
      ];
      rerender(<EndpointLogTabs endpoint={endpoint} />);
      expectLogSource("pod-a", containerName);

      fireEvent.click(
        screen.getByRole("button", { name: "endpoints.logs.previous" }),
      );
      logSources.deployments = [
        {
          ...deployment,
          replicas: deployment.replicas.map((replica) => ({
            ...replica,
            containers: replica.containers.map((container) => ({
              ...container,
              restart_count: 0,
            })),
          })),
        },
      ];
      rerender(<EndpointLogTabs endpoint={endpoint} />);

      expectLogSource("pod-a", containerName);
      expect(screen.queryByLabelText("endpoints.logs.containerRun")).toBeNull();
      expect(
        screen.queryByRole("button", { name: "endpoints.logs.previous" }),
      ).toBeNull();
    },
  );

  it("reports unavailable previous logs without falling back, and allows current", () => {
    vi.mocked(useStreamingLogs).mockImplementation((url) => ({
      logs: url?.includes("previous=true") ? "" : "current log",
      isLoading: false,
      error: url?.includes("previous=true") ? "HTTP 400" : null,
      refetch: vi.fn(),
    }));
    render(<EndpointLogTabs endpoint={endpoint} />);
    fireEvent.click(
      screen.getByRole("button", { name: "endpoints.logs.previous" }),
    );

    expectLogSource("pod-a", "engine", true);
    expect(screen.getByTestId("endpoint-log-viewer").textContent).toContain(
      "endpoints.logs.previousUnavailable",
    );
    expect(screen.queryByText("current log")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "endpoints.logs.current" }),
    );
    expectLogSource("pod-a", "engine");
    expect(screen.getByText("current log")).toBeTruthy();
  });

  it("shows an explicit load error for a deleted Pod without hiding selectors", () => {
    vi.mocked(useStreamingLogs).mockReturnValue({
      logs: "stale log",
      isLoading: false,
      error: "HTTP 404",
      refetch: vi.fn(),
    });
    render(<EndpointLogTabs endpoint={endpoint} />);

    expect(screen.getByTestId("endpoint-log-viewer").textContent).toContain(
      "endpoints.logs.loadError",
    );
    expect(screen.queryByText("stale log")).toBeNull();
    expect(screen.getAllByRole("combobox")).toHaveLength(2);
  });

  it("disables empty sources and clears the viewer instead of retaining old logs", () => {
    const { rerender } = render(<EndpointLogTabs endpoint={endpoint} />);
    logSources.deployments = [];
    rerender(<EndpointLogTabs endpoint={endpoint} />);

    expect(useStreamingLogs).toHaveBeenLastCalledWith(null, false);
    expect(screen.queryByTestId("endpoint-log-viewer")).toBeNull();
    expect(screen.getByText("endpoints.logs.noLogsAvailable")).toBeTruthy();
  });

  it("does not fetch a default Pod log when containers are empty", () => {
    const deployment = makeKubernetesDeployment();
    logSources.deployments = [
      {
        ...deployment,
        replicas: deployment.replicas.map((replica) => ({
          ...replica,
          containers: [],
        })),
      },
    ];
    render(<EndpointLogTabs endpoint={endpoint} />);

    expect(useStreamingLogs).toHaveBeenLastCalledWith(null, false);
    expect(screen.queryByTestId("endpoint-log-viewer")).toBeNull();
    expect(screen.queryByLabelText("endpoints.logs.containerRun")).toBeNull();
  });

  it("reconciles a removed container to current without resetting on unrelated updates", () => {
    const { rerender } = render(<EndpointLogTabs endpoint={endpoint} />);
    selectLogOption("endpoints.logs.container", "init-model");
    fireEvent.click(
      screen.getByRole("button", { name: "endpoints.logs.previous" }),
    );
    const deployment = makeKubernetesDeployment();
    logSources.deployments = [
      {
        ...deployment,
        replicas: deployment.replicas.map((replica) => ({
          ...replica,
          containers: replica.containers.filter(
            (container) => container.type === "container",
          ),
        })),
      },
    ];
    rerender(<EndpointLogTabs endpoint={endpoint} />);

    expectLogSource("pod-a", "engine");
  });

  it.each(["container", "initContainer"])(
    "keeps %s current logs implicit until restart history appears",
    (containerType) => {
      const deployment = makeKubernetesDeployment();
      logSources.deployments = [
        {
          ...deployment,
          replicas: deployment.replicas.map((replica) => ({
            ...replica,
            containers: replica.containers
              .filter((container) => container.type === containerType)
              .map((container) => ({ ...container, restart_count: 0 })),
          })),
        },
      ];
      const { rerender } = render(<EndpointLogTabs endpoint={endpoint} />);

      const containerName =
        containerType === "container" ? "engine" : "init-model";
      expectLogSource("pod-a", containerName);
      expect(screen.queryByLabelText("endpoints.logs.containerRun")).toBeNull();
      expect(
        screen.queryByRole("button", { name: "endpoints.logs.previous" }),
      ).toBeNull();

      logSources.deployments = [deployment];
      rerender(<EndpointLogTabs endpoint={endpoint} />);
      expectLogSource("pod-a", containerName);
      expect(screen.getByLabelText("endpoints.logs.containerRun")).toBeTruthy();
      expect(screen.getByText("endpoints.logs.current")).toBeTruthy();
      expect(screen.getByText("endpoints.logs.previous")).toBeTruthy();
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
    const { rerender } = render(<EndpointLogTabs endpoint={endpoint} />);
    expect(screen.getByTestId("endpoint-log-viewer").textContent).toContain(
      "endpoints.logs.loading",
    );
    fireEvent.click(screen.getByRole("button", { name: "refresh" }));
    expect(logSources.refetch).toHaveBeenCalledOnce();
    expect(refetch).toHaveBeenCalledOnce();

    logSources.isLoading = true;
    rerender(<EndpointLogTabs endpoint={endpoint} />);
    expect(screen.getByText("loading")).toBeTruthy();
  });

  it("shows an empty state when the selected replica has no logs", () => {
    const deployment = makeKubernetesDeployment();
    logSources.deployments = [
      {
        ...deployment,
        replicas: deployment.replicas.map((replica) => ({
          ...replica,
          logs: [],
        })),
      },
    ];
    render(<EndpointLogTabs endpoint={endpoint} />);

    expect(useStreamingLogs).toHaveBeenLastCalledWith(null, false);
    expect(screen.getByText("endpoints.logs.noLogsAvailable")).toBeTruthy();
  });
});

describe("Ray log compatibility", () => {
  it("defaults to application, preserves stderr selection and downloads the same stream", () => {
    logSources.deployments = [
      makeDeployment(2, ["stderr", "stdout", "application"]),
    ];
    render(<EndpointLogTabs endpoint={endpoint} />);
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

  it("keeps failed Actor stderr-only sources available", () => {
    logSources.deployments = [
      { ...makeDeployment(1, ["stderr"]), name: "FailedActor" },
    ];
    render(<EndpointLogTabs endpoint={endpoint} />);

    expect(useStreamingLogs).toHaveBeenLastCalledWith(
      "/endpoints/default/qwen/logs/replica-0/stderr?lines=1000",
      true,
    );
    expect(screen.getByTestId("endpoint-log-viewer")).toBeTruthy();
  });
});
