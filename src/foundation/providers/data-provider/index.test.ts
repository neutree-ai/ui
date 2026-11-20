import { PostgrestClient } from "@supabase/postgrest-js";
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

describe("soft-delete payloads", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it.each([
    { batch: false, forceDelete: false },
    { batch: false, forceDelete: true },
    { batch: true, forceDelete: false },
    { batch: true, forceDelete: true },
  ])(
    "batch $batch, force $forceDelete preserves metadata and omits spec/status",
    async ({ batch, forceDelete }) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-02T00:00:00Z"));
      const metadata = {
        name: "chat",
        workspace: "default",
        display_name: "Production",
        labels: { team: "inference" },
        annotations: { owner: "operator" },
      };
      const fetchMock = vi.fn().mockImplementation(
        async () =>
          new Response(
            JSON.stringify([
              {
                id: 1,
                metadata,
                spec: { replicas: { num: 2 } },
                status: { phase: "Running" },
              },
            ]),
            { headers: { "Content-Type": "application/json" } },
          ),
      );
      vi.stubGlobal("fetch", fetchMock);
      const provider = dataProvider(new PostgrestClient(client.url));
      const params = {
        resource: "endpoints",
        id: "chat",
        ids: ["chat"],
        meta: {
          idColumnName: "metadata->name",
          workspace: "default",
          workspaced: true,
          forceDelete,
        },
      };

      if (batch) await provider.deleteMany(params);
      else await provider.deleteOne(params);

      expect(fetchMock).toHaveBeenCalledTimes(2);
      const [url, request] = fetchMock.mock.calls[1];
      expect(request.method).toBe("PATCH");
      expect(new URL(url).searchParams.get("metadata->name")).toBe('eq."chat"');
      expect(new URL(url).searchParams.get("metadata->workspace")).toBe(
        'eq."default"',
      );
      expect(JSON.parse(request.body)).toEqual({
        metadata: {
          ...metadata,
          deletion_timestamp: "2026-01-02T00:00:00.000Z",
          annotations: forceDelete
            ? { owner: "operator", "neutree.ai/force-delete": "true" }
            : metadata.annotations,
        },
      });
    },
  );
});
