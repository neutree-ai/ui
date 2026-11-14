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

describe("user creation", () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each(["eng", ""])(
    "sends only auth fields when department is %j",
    async (orgUnit) => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: "u-1",
            username: "alice",
            email: "alice@example.org",
          }),
        ),
      );
      vi.stubGlobal("fetch", fetchMock);
      const result = await dataProvider(client as never).create({
        resource: "user_profiles",
        variables: {
          name: "alice",
          email: "alice@example.org",
          password: "password123",
          confirmPassword: "password123",
          orgUnit,
        },
      });
      expect(fetchMock).toHaveBeenCalledWith("/api/v1/auth/admin/users", {
        method: "POST",
        headers: {},
        body: JSON.stringify({
          email: "alice@example.org",
          password: "password123",
          username: "alice",
        }),
      });
      expect(result.data).toEqual({
        id: "u-1",
        username: "alice",
        email: "alice@example.org",
      });
    },
  );
});
