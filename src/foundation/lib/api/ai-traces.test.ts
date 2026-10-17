import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AITraceRequestError,
  exportAITraces,
  fetchAITraceFilterOptions,
  fetchAITraces,
  filenameFromDisposition,
  isAITraceForbidden,
} from "./ai-traces";

vi.mock("@/foundation/lib/api", () => ({
  REST_URL: "/api/v1",
  clientPostgrest: { headers: {} },
}));

const respond = (status: number, body: unknown) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status })),
  );

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("trace request errors", () => {
  it("reports a 403 as forbidden and keeps the server's reason", async () => {
    respond(403, { error: "insufficient permissions" });

    const error = await fetchAITraces({ workspace: "_all_" }).catch((e) => e);

    expect(error).toBeInstanceOf(AITraceRequestError);
    expect(error.status).toBe(403);
    expect(error.message).toContain("insufficient permissions");
    expect(isAITraceForbidden(error)).toBe(true);
  });

  it("does not treat other failures as forbidden", async () => {
    respond(500, { error: "boom" });

    const error = await fetchAITraces({ workspace: "default" }).catch((e) => e);

    expect(error.status).toBe(500);
    expect(isAITraceForbidden(error)).toBe(false);
    expect(isAITraceForbidden(new Error("network down"))).toBe(false);
  });
});

describe("fetchAITraceFilterOptions", () => {
  it("asks for the workspace's options, leaving unset parameters out", async () => {
    respond(200, {
      endpoints: [],
      endpoints_truncated: false,
      models: [],
      models_truncated: false,
    });

    await fetchAITraceFilterOptions({
      workspace: "_all_",
      start: "2026-10-01T00:00:00.000Z",
      end: "2026-10-07T23:59:59.999Z",
      endpoint_type: undefined,
    });

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(
      "/api/v1/ai-traces/_all_/filter-options?start=2026-10-01T00%3A00%3A00.000Z&end=2026-10-07T23%3A59%3A59.999Z",
    );
  });
});

describe("trace export", () => {
  const params = {
    workspace: "_all_",
    api_key_id: "key-1",
    model: undefined,
    status: "",
    start: "2026-10-01T00:00:00.000Z",
    end: "2026-10-07T23:59:59.999Z",
  };

  it("sends the list's params plus the format and names the file from the server", async () => {
    const fetchMock = vi.fn(
      async (_url: string) =>
        new Response("a,b\n", {
          status: 200,
          headers: {
            "Content-Disposition": 'attachment; filename="traces.csv"',
          },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { blob, filename } = await exportAITraces(params, "csv");

    const url = new URL(String(fetchMock.mock.calls[0]?.[0]), "http://x");
    expect(url.pathname).toBe("/api/v1/ai-traces/_all_/export");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      api_key_id: "key-1",
      start: params.start,
      end: params.end,
      format: "csv",
    });
    expect(filename).toBe("traces.csv");
    expect(blob.size).toBe(4);
  });

  it("falls back to a name of its own when the server gives none", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}\n", { status: 200 })),
    );

    const { filename } = await exportAITraces(params, "jsonl");

    expect(filename).toMatch(/^access-log-_all_-\d{4}-\d{2}-\d{2}\.jsonl$/);
  });

  it("throws the server's reason on failure", async () => {
    respond(403, { error: "insufficient permissions" });

    const error = await exportAITraces(params, "csv").catch((e) => e);

    expect(isAITraceForbidden(error)).toBe(true);
    expect(error.message).toContain("insufficient permissions");
  });

  it("reads plain and RFC 5987 file names", () => {
    expect(filenameFromDisposition('attachment; filename="a b.csv"')).toBe(
      "a b.csv",
    );
    expect(filenameFromDisposition("attachment; filename=a.jsonl")).toBe(
      "a.jsonl",
    );
    expect(
      filenameFromDisposition(
        "attachment; filename=\"x.csv\"; filename*=UTF-8''%E6%97%A5%E5%BF%97.csv",
      ),
    ).toBe("日志.csv");
    expect(filenameFromDisposition(null)).toBeNull();
    expect(filenameFromDisposition("attachment")).toBeNull();
  });
});
