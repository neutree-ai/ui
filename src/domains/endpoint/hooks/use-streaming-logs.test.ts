import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useStreamingLogs } from "./use-streaming-logs";

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), fetch: vi.fn() }));

vi.mock("@/foundation/lib/api", () => ({
  REST_URL: "/api/v1",
  clientPostgrest: { headers: { apikey: "public-key" } },
}));
vi.mock("@/foundation/providers/auth-provider", () => ({
  auth: { getSession: mocks.getSession },
}));
vi.mock("react-i18next", () => {
  const translate = (key: string) => key;
  return { useTranslation: () => ({ t: translate }) };
});

function createStream(text = "new log") {
  const reader = {
    read: vi
      .fn()
      .mockResolvedValueOnce({
        done: false,
        value: new TextEncoder().encode(text),
      })
      .mockResolvedValue({ done: true }),
    cancel: vi.fn().mockResolvedValue(undefined),
    releaseLock: vi.fn(),
  };
  const body = {
    getReader: () => reader,
    cancel: vi.fn().mockResolvedValue(undefined),
  };
  const response = { ok: true, status: 200, body } as unknown as Response;
  return { response, reader, body };
}

function renderLogs(url: string | null = "/logs/old", enabled = true) {
  return renderHook(
    (props: { url: string | null; enabled: boolean }) =>
      useStreamingLogs(props.url, props.enabled),
    { initialProps: { url, enabled } },
  );
}

async function settle() {
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  mocks.getSession
    .mockReset()
    .mockResolvedValue({ data: { session: { access_token: "token" } } });
  mocks.fetch
    .mockReset()
    .mockImplementation(async () => createStream().response);
  vi.stubGlobal("fetch", mocks.fetch);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("useStreamingLogs source ownership", () => {
  it("streams with authentication, merges headers and releases the reader", async () => {
    const stream = createStream("ready");
    mocks.fetch.mockResolvedValue(stream.response);
    const { result } = renderLogs();
    expect(result.current.isLoading).toBe(true);
    await settle();

    expect(result.current.logs).toBe("ready");
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(mocks.fetch).toHaveBeenCalledWith(
      "/api/v1/logs/old",
      expect.objectContaining({
        headers: { apikey: "public-key", Authorization: "Bearer token" },
        signal: expect.any(AbortSignal),
      }),
    );
    expect(stream.reader.releaseLock).toHaveBeenCalledOnce();
  });

  it("does not start an old fetch after stale authentication resolves", async () => {
    const oldSession = Promise.withResolvers<{ data: { session: null } }>();
    mocks.getSession.mockReturnValueOnce(oldSession.promise);
    const { result, rerender } = renderLogs();
    rerender({ url: "/logs/new", enabled: true });
    await settle();
    expect(result.current.logs).toBe("new log");

    oldSession.resolve({ data: { session: null } });
    await settle();
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(mocks.fetch.mock.calls[0][0]).toBe("/api/v1/logs/new");
    expect(result.current.logs).toBe("new log");
  });

  it("ignores stale authentication rejection and does not block the new request", async () => {
    const oldSession = Promise.withResolvers<never>();
    mocks.getSession.mockReturnValueOnce(oldSession.promise);
    const { result, rerender } = renderLogs();
    rerender({ url: "/logs/new", enabled: true });
    await settle();
    oldSession.reject(new Error("stale auth"));
    await settle();

    expect(result.current.logs).toBe("new log");
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it("aborts pending fetches and prevents stale finally from clearing a new loading state", async () => {
    const oldFetch = Promise.withResolvers<Response>();
    const newRead =
      Promise.withResolvers<ReadableStreamReadResult<Uint8Array>>();
    const newStream = createStream();
    newStream.reader.read
      .mockReset()
      .mockReturnValueOnce(newRead.promise)
      .mockResolvedValue({ done: true });
    mocks.fetch
      .mockReturnValueOnce(oldFetch.promise)
      .mockResolvedValueOnce(newStream.response);
    const { result, rerender } = renderLogs();
    await settle();
    const oldSignal = mocks.fetch.mock.calls[0][1].signal as AbortSignal;

    rerender({ url: "/logs/new", enabled: true });
    await settle();
    expect(oldSignal.aborted).toBe(true);
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    oldFetch.resolve(createStream("stale log").response);
    await settle();
    expect(result.current.logs).toBe("");
    expect(result.current.isLoading).toBe(true);

    newRead.resolve({
      done: false,
      value: new TextEncoder().encode("new source"),
    });
    await settle();
    expect(result.current.logs).toBe("new source");
    expect(result.current.isLoading).toBe(false);
  });

  it("ignores stale fetch errors after a source switch", async () => {
    const oldFetch = Promise.withResolvers<Response>();
    mocks.fetch.mockReturnValueOnce(oldFetch.promise);
    const { result, rerender } = renderLogs();
    await settle();
    rerender({ url: "/logs/new", enabled: true });
    await settle();
    oldFetch.reject(new Error("old fetch failed"));
    await settle();

    expect(result.current.logs).toBe("new log");
    expect(result.current.error).toBeNull();
  });

  it.each(["resolve", "reject"])(
    "cancels a stale reader and ignores its late %s",
    async (outcome) => {
      const oldRead =
        Promise.withResolvers<ReadableStreamReadResult<Uint8Array>>();
      const stream = createStream();
      stream.reader.read
        .mockReset()
        .mockReturnValueOnce(oldRead.promise)
        .mockResolvedValue({ done: true });
      mocks.fetch.mockResolvedValueOnce(stream.response);
      const { result, rerender } = renderLogs();
      await settle();
      rerender({ url: "/logs/new", enabled: true });
      await settle();

      expect(stream.reader.cancel).toHaveBeenCalledOnce();
      if (outcome === "resolve")
        oldRead.resolve({
          done: false,
          value: new TextEncoder().encode("stale chunk"),
        });
      else oldRead.reject(new Error("stale reader"));
      await settle();
      expect(result.current.logs).toBe("new log");
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
    },
  );

  it.each([
    { url: null, enabled: true },
    { url: "", enabled: true },
    { url: "/logs/old", enabled: false },
  ])("clears content and errors for an inactive source: %j", async (props) => {
    const { result, rerender } = renderLogs();
    await settle();
    expect(result.current.logs).toBe("new log");
    rerender(props);
    expect(result.current.logs).toBe("");
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
    await act(async () => {
      vi.advanceTimersByTime(30000);
    });
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });

  it("unmounts during auth without fetching or leaving a timer", async () => {
    const session = Promise.withResolvers<{ data: { session: null } }>();
    mocks.getSession.mockReturnValue(session.promise);
    const { unmount } = renderLogs();
    unmount();
    session.resolve({ data: { session: null } });
    await settle();

    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("unmounts during a read and cancels both transport and reader", async () => {
    const pending =
      Promise.withResolvers<ReadableStreamReadResult<Uint8Array>>();
    const stream = createStream();
    stream.reader.read.mockReturnValueOnce(pending.promise);
    mocks.fetch.mockResolvedValueOnce(stream.response);
    const { unmount } = renderLogs();
    await settle();
    const signal = mocks.fetch.mock.calls[0][1].signal as AbortSignal;
    unmount();

    expect(signal.aborted).toBe(true);
    expect(stream.reader.cancel).toHaveBeenCalledOnce();
    pending.resolve({ done: true, value: undefined });
    await settle();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("useStreamingLogs errors and refresh", () => {
  it.each([400, 404])(
    "reports HTTP %s for previous without requesting current",
    async (status) => {
      mocks.fetch.mockResolvedValue({ ok: false, status });
      const { result } = renderLogs(
        "/logs/pod/logs?container=engine&previous=true",
      );
      await settle();

      expect(result.current.logs).toBe("");
      expect(result.current.error).not.toBeNull();
      expect(mocks.fetch).toHaveBeenCalledTimes(1);
      expect(mocks.fetch.mock.calls[0][0]).toContain("previous=true");
    },
  );

  it("does not mark a failed initial load as successful on retry", async () => {
    mocks.fetch.mockRejectedValueOnce(new Error("offline"));
    const { result } = renderLogs();
    await settle();
    expect(result.current.error).toBe("offline");

    const pending = Promise.withResolvers<Response>();
    mocks.fetch.mockReturnValueOnce(pending.promise);
    act(() => result.current.refetch());
    await settle();
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeNull();
    pending.resolve(createStream("recovered").response);
    await settle();
    expect(result.current.logs).toBe("recovered");
  });

  it("reports unreadable bodies and unknown failures", async () => {
    mocks.fetch.mockResolvedValueOnce({ ok: true, body: null });
    const { result } = renderLogs();
    await settle();
    expect(result.current.error).not.toBeNull();

    mocks.fetch.mockRejectedValueOnce("network failure");
    act(() => result.current.refetch());
    await settle();
    expect(result.current.error).not.toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it("releases a failed active reader and recovers on refetch", async () => {
    const failedStream = createStream();
    failedStream.reader.read
      .mockReset()
      .mockRejectedValue(new Error("read interrupted"));
    const recoveredStream = createStream("recovered logs");
    mocks.fetch
      .mockResolvedValueOnce(failedStream.response)
      .mockResolvedValueOnce(recoveredStream.response);

    const { result } = renderLogs();
    await settle();

    expect(result.current.error).toBe("read interrupted");
    expect(result.current.logs).toBe("");
    expect(result.current.isLoading).toBe(false);
    expect(failedStream.reader.releaseLock).toHaveBeenCalledOnce();

    act(() => result.current.refetch());
    await settle();

    expect(result.current.logs).toBe("recovered logs");
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(recoveredStream.reader.releaseLock).toHaveBeenCalledOnce();
  });

  it("keeps successful same-URL auto refresh silent until the whole stream completes", async () => {
    const { result } = renderLogs();
    await settle();
    const pending =
      Promise.withResolvers<ReadableStreamReadResult<Uint8Array>>();
    const refresh = createStream("first half");
    refresh.reader.read
      .mockReset()
      .mockResolvedValueOnce({
        done: false,
        value: new TextEncoder().encode("first half"),
      })
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValue({ done: true });
    mocks.fetch.mockResolvedValueOnce(refresh.response);
    await act(async () => {
      vi.advanceTimersByTime(10000);
    });

    expect(result.current.logs).toBe("new log");
    expect(result.current.isLoading).toBe(false);
    pending.resolve({
      done: false,
      value: new TextEncoder().encode(" second half"),
    });
    await settle();
    expect(result.current.logs).toBe("first half second half");
  });

  it("keeps manual refresh silent after success without overlapping active requests", async () => {
    const { result } = renderLogs();
    await settle();
    const pending = Promise.withResolvers<Response>();
    mocks.fetch.mockReturnValueOnce(pending.promise);
    act(() => result.current.refetch());
    await settle();
    await act(async () => {
      vi.advanceTimersByTime(30000);
    });

    expect(result.current.logs).toBe("new log");
    expect(result.current.isLoading).toBe(false);
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    pending.resolve(createStream("refreshed").response);
    await settle();
    expect(result.current.logs).toBe("refreshed");
  });

  it("clears a previous error and starts visibly when enabling a disabled source", async () => {
    mocks.fetch.mockRejectedValueOnce(new Error("offline"));
    const { result, rerender } = renderLogs();
    await settle();
    rerender({ url: "/logs/old", enabled: false });
    expect(result.current.error).toBeNull();
    const pending = Promise.withResolvers<Response>();
    mocks.fetch.mockReturnValueOnce(pending.promise);
    rerender({ url: "/logs/old", enabled: true });
    await settle();
    expect(result.current.isLoading).toBe(true);
    pending.resolve(createStream().response);
    await settle();
    expect(result.current.logs).toBe("new log");
  });

  it("decodes UTF-8 split across chunks and flushes an incomplete final character", async () => {
    const stream = createStream();
    const bytes = new TextEncoder().encode("日志");
    stream.reader.read
      .mockReset()
      .mockResolvedValueOnce({ done: false, value: bytes.slice(0, 2) })
      .mockResolvedValueOnce({ done: false, value: bytes.slice(2) })
      .mockResolvedValueOnce({ done: false, value: new Uint8Array([0xe6]) })
      .mockResolvedValue({ done: true });
    mocks.fetch.mockResolvedValueOnce(stream.response);
    const { result } = renderLogs();
    await settle();

    expect(result.current.logs).toBe("日志�");
  });
});
