import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AITraceRequestError,
  fetchAITraces,
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
