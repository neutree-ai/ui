import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Endpoint } from "@/domains/endpoint/types";
import { EndpointLogTabs } from "./EndpointLogTabs";
import { LogViewer } from "./LogViewer";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  fetch: vi.fn(),
  error: vi.fn(),
  save: vi.fn(),
  createObjectURL: vi.fn(),
  revokeObjectURL: vi.fn(),
}));

vi.mock("@refinedev/core", () => ({
  useList: () => ({ data: undefined }),
}));
vi.mock("@/foundation/providers/auth-provider", () => ({
  auth: { getSession: mocks.getSession },
}));
vi.mock("sonner", () => ({ toast: { error: mocks.error } }));
vi.mock("./VirtualLog", () => ({
  VirtualLog: ({ log }: { log: string }) => (
    <pre data-testid="virtual-log">{log}</pre>
  ),
}));
vi.mock("@/domains/endpoint/hooks/use-streaming-logs", () => ({
  useStreamingLogs: () => ({
    logs: "ready",
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));
vi.mock(
  "@/domains/endpoint/hooks/use-endpoint-log-sources",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@/domains/endpoint/hooks/use-endpoint-log-sources")
    >()),
    useEndpointLogSources: () => ({
      deployments: [
        {
          name: "Backend",
          replicas: [
            {
              replica_id: "pod-a",
              logs: [
                {
                  type: "logs",
                  container_name: "engine",
                  restart_count: 2,
                  url: "/api/v1/logs/pod-a/logs?container=engine&tail=true",
                  download_url:
                    "/api/v1/logs/pod-a/logs?container=engine&tail=true&download=true",
                },
                {
                  type: "logs",
                  container_name: "init-model",
                  restart_count: 1,
                  url: "/api/v1/logs/pod-a/logs?container=init-model&tail=true",
                  download_url:
                    "/api/v1/logs/pod-a/logs?container=init-model&tail=true&download=true",
                },
              ],
            },
          ],
        },
      ],
      isLoading: false,
      refetch: vi.fn(),
    }),
  }),
);

const endpoint = {
  metadata: { workspace: "default", name: "model" },
  spec: { engine: { engine: "vllm", version: "test" } },
} as Endpoint;

async function settle() {
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getSession.mockResolvedValue({
    data: { session: { access_token: "token" } },
  });
  mocks.fetch.mockResolvedValue(new Response("downloaded logs"));
  mocks.createObjectURL.mockReturnValue("blob:logs");
  vi.stubGlobal("fetch", mocks.fetch);
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: mocks.createObjectURL,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: mocks.revokeObjectURL,
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    mocks.save(this.download);
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("LogViewer loading", () => {
  it("shows the loading message instead of the log list until the logs arrive", () => {
    const { rerender } = render(<LogViewer source="" isLoading />);

    screen.getByText("endpoints.logs.loading");
    expect(screen.queryByTestId("virtual-log")).toBeNull();

    rerender(<LogViewer source="line 1" />);

    screen.getByTestId("virtual-log");
  });
});

describe("LogViewer downloads", () => {
  it.each(["current", "previous"])(
    "downloads the selected container's %s logs with auth and releases resources",
    async (run) => {
      const filename = `default-model-pod-a-init-model-${run}.log`;
      mocks.fetch.mockResolvedValueOnce(
        new Response("downloaded logs", {
          headers: {
            "Content-Disposition": `attachment; filename="${filename}"`,
          },
        }),
      );
      render(<EndpointLogTabs endpoint={endpoint} clusterType="kubernetes" />);
      fireEvent.click(
        screen.getByRole("combobox", { name: "endpoints.logs.container" }),
      );
      fireEvent.click(screen.getByRole("option", { name: "init-model" }));
      fireEvent.click(
        screen.getByRole("button", { name: `endpoints.logs.${run}` }),
      );
      fireEvent.click(
        screen.getByRole("button", { name: "components.logViewer.download" }),
      );
      await settle();

      const [requestedUrl, options] = mocks.fetch.mock.calls[0];
      const url = new URL(requestedUrl, "http://localhost");
      expect(url.pathname).toBe("/api/v1/logs/pod-a/logs");
      expect(Object.fromEntries(url.searchParams)).toEqual({
        download: "true",
        tail: "true",
        container: "init-model",
        ...(run === "previous" ? { previous: "true" } : {}),
      });
      expect(options.headers).toEqual({ Authorization: "Bearer token" });
      expect(mocks.save).toHaveBeenCalledExactlyOnceWith(filename);
      expect(mocks.revokeObjectURL).toHaveBeenCalledWith("blob:logs");
      expect(document.querySelector("a[download]")).toBeNull();
    },
  );

  it("aborts a download and discards its late blob after the selection changes", async () => {
    const pending = Promise.withResolvers<Blob>();
    const response = new Response("old logs");
    vi.spyOn(response, "blob").mockReturnValue(pending.promise);
    mocks.fetch.mockResolvedValueOnce(response);
    const { rerender } = render(<LogViewer source="old" downloadUrl="/old" />);
    fireEvent.click(
      screen.getByRole("button", { name: "components.logViewer.download" }),
    );
    await settle();
    const signal = mocks.fetch.mock.calls[0][1].signal as AbortSignal;
    rerender(<LogViewer source="new" downloadUrl="/new" />);
    expect(signal.aborted).toBe(true);
    pending.resolve(new Blob(["old logs"]));
    await settle();

    expect(mocks.createObjectURL).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.error).not.toHaveBeenCalled();
  });
});
