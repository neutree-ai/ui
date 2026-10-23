import { afterEach, describe, expect, it, vi } from "vitest";
import { dataProvider } from ".";

const client = {
  url: "http://example.test/api/v1",
  headers: {},
};

describe("dataProvider custom responses", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("accepts a successful response with an empty body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    );

    await expect(
      dataProvider(client as never).custom({
        url: "/rpc/delete_api_key_project",
        method: "post",
        payload: { p_project_id: "project-id" },
      }),
    ).resolves.toEqual({ data: null });
  });

  it("continues to parse JSON responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ id: "project-id" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(
      dataProvider(client as never).custom({
        url: "/rpc/create_api_key_project",
        method: "post",
        payload: {},
      }),
    ).resolves.toEqual({ data: { id: "project-id" } });
  });

  it("sends the method upper-cased, as fetch requires for PATCH", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await dataProvider(client as never).custom({
      url: "/license",
      method: "patch",
      payload: { code: "license-code" },
    });
    expect(fetchMock.mock.calls[0][1].method).toBe("PATCH");
  });
});
