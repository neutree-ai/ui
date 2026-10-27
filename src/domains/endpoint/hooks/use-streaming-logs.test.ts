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

function renderLogs() {
  return renderHook(
    (props: { url: string; enabled: boolean }) =>
      useStreamingLogs(props.url, props.enabled),
    { initialProps: { url: "/logs/old", enabled: true } },
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
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useStreamingLogs source ownership", () => {
  it("ignores stale responses without clearing the current loading state", async () => {
    const oldFetch = Promise.withResolvers<Response>();
    const newRead =
      Promise.withResolvers<ReadableStreamReadResult<Uint8Array>>();
    const oldStream = createStream("stale log");
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
    oldFetch.resolve(oldStream.response);
    await settle();
    expect(oldStream.body.cancel).toHaveBeenCalledOnce();
    expect(result.current.logs).toBe("");
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeNull();

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

  it.each(["source change", "unmount"])(
    "cancels the transport and releases the reader on %s",
    async (action) => {
      const pending =
        Promise.withResolvers<ReadableStreamReadResult<Uint8Array>>();
      const stream = createStream("old log");
      stream.reader.read.mockReturnValueOnce(pending.promise);
      mocks.fetch.mockResolvedValueOnce(stream.response);
      const { result, rerender, unmount } = renderLogs();
      await settle();
      expect(result.current.logs).toBe("old log");
      const signal = mocks.fetch.mock.calls[0][1].signal as AbortSignal;

      if (action === "source change")
        rerender({ url: "/logs/new", enabled: true });
      else unmount();
      await settle();

      expect(signal.aborted).toBe(true);
      expect(stream.reader.cancel).toHaveBeenCalledOnce();
      pending.resolve({
        done: false,
        value: new TextEncoder().encode("stale chunk"),
      });
      await settle();
      expect(stream.reader.releaseLock).toHaveBeenCalledOnce();
      if (action === "source change") {
        expect(result.current.logs).toBe("new log");
        expect(result.current.error).toBeNull();
        expect(result.current.isLoading).toBe(false);
      }
    },
  );
});

describe("useStreamingLogs refresh and decoding", () => {
  it("preserves cached logs after a failed refresh until the retry completes", async () => {
    const { result } = renderLogs();
    await settle();
    mocks.fetch.mockResolvedValueOnce({ ok: false, status: 500 } as Response);

    await act(async () => {
      vi.advanceTimersByTime(10000);
    });

    expect(result.current.logs).toBe("new log");
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe("endpoints.logs.httpError:500");

    const pending =
      Promise.withResolvers<ReadableStreamReadResult<Uint8Array>>();
    const retry = createStream("refreshed log");
    retry.reader.read
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValue({ done: true });
    mocks.fetch.mockResolvedValueOnce(retry.response);

    await act(async () => {
      vi.advanceTimersByTime(10000);
    });

    expect(result.current.logs).toBe("new log");
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();

    pending.resolve({ done: true, value: undefined });
    await settle();

    expect(result.current.logs).toBe("refreshed log");
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it.each(["automatic", "manual"])(
    "keeps same-URL %s refresh silent without overlapping requests",
    async (refreshType) => {
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
        if (refreshType === "automatic") vi.advanceTimersByTime(10000);
        else result.current.refetch();
      });
      await act(async () => {
        vi.advanceTimersByTime(30000);
      });

      expect(result.current.logs).toBe("new log");
      expect(result.current.isLoading).toBe(false);
      expect(mocks.fetch).toHaveBeenCalledTimes(2);
      pending.resolve({
        done: false,
        value: new TextEncoder().encode(" second half"),
      });
      await settle();
      expect(result.current.logs).toBe("first half second half");
      expect(result.current.isLoading).toBe(false);
    },
  );

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
