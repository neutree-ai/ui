import type { TFunction } from "i18next";
import { describe, expect, it } from "vitest";
import type { ApiKey } from "@/domains/api-key/types";
import {
  allowedModelView,
  apiKeyRowView,
  apiKeyStatus,
  keyWorkspaces,
  liveKeysNewestFirst,
  overallTokenQuota,
  rankingKeys,
} from "./api-key-display-list";

const t = ((key: string) => key) as TFunction;
const key = (
  id: string,
  metadata: Partial<ApiKey["metadata"]> = {},
  spec: Partial<ApiKey["spec"]> = {},
) =>
  ({
    id,
    metadata: { name: id, workspace: "ws-a", ...metadata },
    spec,
  }) as ApiKey;

it("names a row by the label rule and hides a blank description and workspace", () => {
  expect(
    apiKeyRowView(
      key("k1", { display_name: " ", workspace: "" }, { description: " " }),
    ),
  ).toEqual({ name: "k1", description: null, workspace: null });
});

it.each([
  [{ disabled: true }, true, "api_keys.limits.statusDisabled", true],
  [{}, true, "api_keys.limits.statusQuotaExceeded", true],
  [{}, false, "api_keys.limits.statusActive", false],
])(
  "a key with limits %j, quota exceeded %s, is %s",
  (limits, exceeded, label, alert) => {
    const status = apiKeyStatus(key("k1", {}, { limits }), t, exceeded);
    expect(status).toMatchObject({ label, alert });
  },
);

describe("rankingKeys", () => {
  const keys = [
    key("k1", { display_name: "Key one" }),
    key("k2", { workspace: "ws-b" }),
    key("k3", { deletion_timestamp: "2026-01-01T00:00:00Z" }),
  ];

  it("lists the live keys of the scoped workspace by name", () => {
    expect(rankingKeys(keys, "ws-a").map((row) => row.name)).toEqual([
      "Key one",
    ]);
  });

  it("lists every workspace's live keys when unscoped", () => {
    expect(rankingKeys(keys).map((row) => row.id)).toEqual(["k1", "k2"]);
  });

  it("falls back to the id without a name", () => {
    expect(rankingKeys([key("k4", { name: "" })])[0].name).toBe("k4");
  });
});

it("orders live keys newest first", () => {
  const keys = [
    key("old", { creation_timestamp: "2026-01-01T00:00:00Z" }),
    key("gone", { deletion_timestamp: "2026-01-03T00:00:00Z" }),
    key("new", { creation_timestamp: "2026-01-02T00:00:00Z" }),
  ];
  expect(liveKeysNewestFirst(keys).map((k) => k.id)).toEqual(["new", "old"]);
});

it("collects the distinct workspaces of keys, skipping missing ones", () => {
  const keys = [key("k1"), key("k2"), key("k3", { workspace: null })];
  expect(keyWorkspaces(keys)).toEqual(["ws-a"]);
});

it.each([
  [{ token_quota: { limit: 100 } }, { limit: 100, period: "monthly" }],
  [
    { token_quota: { limit: 5, period: "daily" } },
    { limit: 5, period: "daily" },
  ],
  [{ token_quota: { period: "daily" } }, null],
  [null, null],
])("the overall quota of %j is %j", (limits, expected) => {
  expect(overallTokenQuota(limits)).toEqual(expected);
});

describe("allowedModelView", () => {
  const served = {
    name: "chat",
    type: "external",
    source: "hybrid",
    phase: "Running",
  };
  const modelMap = new Map([["qwen", { endpoints: [served] }]]);

  it("finds the listed endpoint of a pinned entry and takes its source", () => {
    const view = allowedModelView(
      { model: "qwen", type: "external", endpoint_name: "chat" },
      modelMap,
      0,
    );
    expect(view).toMatchObject({
      endpointName: "chat",
      endpoint: served,
      source: "hybrid",
    });
  });

  it("derives the source from the type when the endpoint is not listed", () => {
    const view = allowedModelView(
      { model: "qwen", type: "internal", endpoint_name: "gone" },
      modelMap,
      0,
    );
    expect(view).toMatchObject({ endpoint: undefined, source: "self-hosted" });
  });

  it("names no endpoint for an entry matching any endpoint", () => {
    expect(
      allowedModelView({ model: "qwen" }, modelMap, 0).endpointName,
    ).toBeNull();
  });
});
