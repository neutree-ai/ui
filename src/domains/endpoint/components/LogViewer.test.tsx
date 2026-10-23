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
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("./VirtualLog", () => ({
  VirtualLog: ({
    log,
    search,
    reverse,
    startTime,
    endTime,
  }: {
    log: string;
    search?: string;
    reverse?: boolean;
    startTime?: string;
    endTime?: string;
  }) => (
    <pre
      data-testid="filtered-logs"
      data-search={search}
      data-reverse={reverse}
      data-start={startTime}
      data-end={endTime}
    >
      {log}
    </pre>
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
                  url: "/api/v1/logs/pod-a/logs?tail=true",
                  download_url:
                    "/api/v1/logs/pod-a/logs?download=true&tail=true",
                },
              ],
              containers: [
                { name: "engine", type: "container", restart_count: 2 },
                { name: "init-model", type: "initContainer", restart_count: 1 },
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

function downloadResponse(filename = "default-model-pod-a-engine-current.log") {
  return {
    ok: true,
    status: 200,
    blob: vi.fn().mockResolvedValue(new Blob(["downloaded logs"])),
    headers: new Headers({
      "Content-Disposition": `attachment; filename="${filename}"`,
    }),
  } as unknown as Response;
}

async function settle() {
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  mocks.getSession
    .mockReset()
    .mockResolvedValue({ data: { session: { access_token: "token" } } });
  mocks.fetch.mockReset().mockResolvedValue(downloadResponse());
  mocks.error.mockReset();
  mocks.createObjectURL.mockReset().mockReturnValue("blob:logs");
  mocks.revokeObjectURL.mockReset();
  vi.stubGlobal("fetch", mocks.fetch);
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: mocks.createObjectURL,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: mocks.revokeObjectURL,
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("EndpointLogTabs real downloads", () => {
  it("passes the selected container/run query to the real LogViewer fetch", async () => {
    render(<EndpointLogTabs endpoint={endpoint} />);
    fireEvent.click(
      screen.getByRole("combobox", { name: "endpoints.logs.container" }),
    );
    fireEvent.click(screen.getByRole("option", { name: "init-model" }));
    fireEvent.click(
      screen.getByRole("button", { name: "endpoints.logs.previous" }),
    );
    mocks.fetch.mockResolvedValueOnce(
      downloadResponse("default-model-pod-a-init-model-previous.log"),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "components.logViewer.download" }),
    );
    await settle();

    const previous = new URL(mocks.fetch.mock.calls[0][0], "http://localhost");
    expect(previous.pathname).toBe("/api/v1/logs/pod-a/logs");
    expect(Object.fromEntries(previous.searchParams)).toEqual({
      download: "true",
      tail: "true",
      container: "init-model",
      previous: "true",
    });
    expect(mocks.fetch.mock.calls[0][1].headers).toEqual({
      Authorization: "Bearer token",
    });
    expect(mocks.revokeObjectURL).toHaveBeenCalledWith("blob:logs");

    fireEvent.click(
      screen.getByRole("button", { name: "endpoints.logs.current" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "components.logViewer.download" }),
    );
    await settle();
    const current = new URL(mocks.fetch.mock.calls[1][0], "http://localhost");
    expect(current.searchParams.get("container")).toBe("init-model");
    expect(current.searchParams.has("previous")).toBe(false);
    expect(current.searchParams.get("download")).toBe("true");
  });

  it("localizes unavailable previous downloads instead of showing backend JSON or HTTP only", async () => {
    mocks.fetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: "previous logs are unavailable for container engine",
      }),
      text: async () =>
        '{"error":"previous logs are unavailable for container engine"}',
    });
    render(<EndpointLogTabs endpoint={endpoint} />);
    fireEvent.click(
      screen.getByRole("button", { name: "endpoints.logs.previous" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "components.logViewer.download" }),
    );
    await settle();

    expect(mocks.error).toHaveBeenCalledWith(
      "endpoints.logs.previousUnavailable",
    );
    expect(mocks.createObjectURL).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "endpoints.logs.current" }),
    );
    expect(screen.getByText("ready")).toBeTruthy();
  });
});

describe("LogViewer download ownership", () => {
  it("can refresh and unmount without a download source", () => {
    const onRefresh = vi.fn();
    const { unmount } = render(
      <LogViewer source="log" onRefresh={onRefresh} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "buttons.refresh" }));

    expect(onRefresh).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole("button", { name: "components.logViewer.download" }),
    ).toBeNull();
    expect(() => unmount()).not.toThrow();
  });

  it("uses the Content-Disposition filename and releases temporary browser resources", async () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        expect(this.download).toBe("default-model-pod-a-engine-current.log");
      });
    render(
      <LogViewer
        source="log"
        downloadUrl="/logs?container=engine&download=true"
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "components.logViewer.download" }),
    );
    await settle();

    expect(click).toHaveBeenCalledOnce();
    expect(document.querySelector("a[download]")).toBeNull();
    expect(mocks.revokeObjectURL).toHaveBeenCalledOnce();
  });

  it("does not fetch a stale download after authentication resolves", async () => {
    const pending = Promise.withResolvers<{ data: { session: null } }>();
    mocks.getSession.mockReturnValueOnce(pending.promise);
    const { rerender } = render(<LogViewer source="old" downloadUrl="/old" />);
    fireEvent.click(
      screen.getByRole("button", { name: "components.logViewer.download" }),
    );
    rerender(<LogViewer source="new" downloadUrl="/new" />);
    fireEvent.click(
      screen.getByRole("button", { name: "components.logViewer.download" }),
    );
    await settle();
    pending.resolve({ data: { session: null } });
    await settle();

    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(mocks.fetch.mock.calls[0][0]).toBe("/new");
  });

  it("aborts a pending download on source changes and ignores a stale blob", async () => {
    const pending = Promise.withResolvers<Blob>();
    const response = downloadResponse();
    vi.mocked(response.blob).mockReturnValue(pending.promise);
    mocks.fetch.mockResolvedValueOnce(response);
    const { rerender } = render(<LogViewer source="old" downloadUrl="/old" />);
    fireEvent.click(
      screen.getByRole("button", { name: "components.logViewer.download" }),
    );
    await settle();
    const signal = mocks.fetch.mock.calls[0][1].signal as AbortSignal;
    rerender(<LogViewer source="new" downloadUrl="/new" />);
    expect(signal.aborted).toBe(true);
    pending.resolve(new Blob(["old"]));
    await settle();

    expect(mocks.createObjectURL).not.toHaveBeenCalled();
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it("aborts on unmount and ignores stale fetch errors", async () => {
    const pending = Promise.withResolvers<Response>();
    mocks.fetch.mockReturnValueOnce(pending.promise);
    const { unmount } = render(<LogViewer source="old" downloadUrl="/old" />);
    fireEvent.click(
      screen.getByRole("button", { name: "components.logViewer.download" }),
    );
    await settle();
    const signal = mocks.fetch.mock.calls[0][1].signal as AbortSignal;
    unmount();
    expect(signal.aborted).toBe(true);
    pending.reject(new Error("old failure"));
    await settle();

    expect(mocks.error).not.toHaveBeenCalled();
  });

  it("reports current download errors with localized text", async () => {
    mocks.fetch.mockRejectedValueOnce(new Error("offline"));
    render(<LogViewer source="log" downloadUrl="/logs" />);
    fireEvent.click(
      screen.getByRole("button", { name: "components.logViewer.download" }),
    );
    await settle();

    expect(mocks.error).toHaveBeenCalledWith(
      "components.logViewer.downloadFailed",
    );
  });

  it("cancels a stale response body without downloading it", async () => {
    const pending = Promise.withResolvers<Response>();
    const cancel = vi.fn().mockResolvedValue(undefined);
    mocks.fetch.mockReturnValueOnce(pending.promise);
    const { rerender } = render(<LogViewer source="old" downloadUrl="/old" />);
    fireEvent.click(
      screen.getByRole("button", { name: "components.logViewer.download" }),
    );
    await settle();
    rerender(<LogViewer source="new" downloadUrl="/new" />);
    pending.resolve({
      ...downloadResponse(),
      body: { cancel },
    } as unknown as Response);
    await settle();

    expect(cancel).toHaveBeenCalledOnce();
    expect(mocks.createObjectURL).not.toHaveBeenCalled();
  });

  it("does not let a stale finally detach a newer download", async () => {
    const first = Promise.withResolvers<Response>();
    const second = Promise.withResolvers<Response>();
    mocks.fetch
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    render(<LogViewer source="log" downloadUrl="/logs" />);
    fireEvent.click(
      screen.getByRole("button", { name: "components.logViewer.download" }),
    );
    await settle();
    const firstSignal = mocks.fetch.mock.calls[0][1].signal as AbortSignal;
    fireEvent.click(
      screen.getByRole("button", { name: "components.logViewer.download" }),
    );
    await settle();
    expect(firstSignal.aborted).toBe(true);
    first.reject(new Error("old failure"));
    await settle();
    second.resolve(downloadResponse());
    await settle();

    expect(mocks.createObjectURL).toHaveBeenCalledOnce();
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it("omits auth when logged out and strips queries from the fallback filename", async () => {
    mocks.getSession.mockResolvedValueOnce({ data: { session: null } });
    mocks.fetch.mockResolvedValueOnce({
      ...downloadResponse(),
      headers: new Headers(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      expect(this.download).toBe("logs");
    });
    render(
      <LogViewer
        source="log"
        downloadUrl="/logs?container=engine&download=true"
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "components.logViewer.download" }),
    );
    await settle();

    expect(mocks.fetch.mock.calls[0][1].headers).toEqual({});
    expect(mocks.revokeObjectURL).toHaveBeenCalledOnce();
  });
});

describe("LogViewer translated toolbar", () => {
  it("updates filters and exposes a translated clear action", () => {
    render(<LogViewer source="log" />);
    fireEvent.change(
      screen.getByRole("textbox", { name: "components.logViewer.search" }),
      { target: { value: "error" } },
    );
    fireEvent.click(
      screen.getByRole("checkbox", { name: "components.logViewer.reverse" }),
    );
    expect(
      screen.getByTestId("filtered-logs").getAttribute("data-search"),
    ).toBe("error");
    expect(
      screen.getByTestId("filtered-logs").getAttribute("data-reverse"),
    ).toBe("true");

    fireEvent.click(
      screen.getByRole("button", { name: "components.logViewer.startTime" }),
    );
    const start = screen.getByLabelText("components.logViewer.startTime");
    fireEvent.change(start, { target: { value: "2026-10-20T10:00" } });
    fireEvent.keyDown(start, { key: "Escape" });
    fireEvent.click(
      screen.getByRole("button", { name: "components.logViewer.endTime" }),
    );
    const end = screen.getByLabelText("components.logViewer.endTime");
    fireEvent.change(end, { target: { value: "2026-10-20T12:00" } });
    fireEvent.keyDown(end, { key: "Escape" });
    expect(screen.getByTestId("filtered-logs").getAttribute("data-start")).toBe(
      "2026-10-20T10:00",
    );
    expect(screen.getByTestId("filtered-logs").getAttribute("data-end")).toBe(
      "2026-10-20T12:00",
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "components.logViewer.clearTimeFilters",
      }),
    );

    expect(
      screen.getByTestId("filtered-logs").getAttribute("data-start"),
    ).toBeNull();
    expect(
      screen.getByTestId("filtered-logs").getAttribute("data-end"),
    ).toBeNull();
    expect(
      screen.queryByRole("button", {
        name: "components.logViewer.clearTimeFilters",
      }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "buttons.refresh" }));
  });
});
