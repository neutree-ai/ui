import { describe, expect, it } from "vitest";
import type { Cluster } from "../types";
import {
  type CacheDependentEndpoint,
  canStartUpgrade,
  defaultUpgradeAction,
  effectiveUpgrade,
  targetRuntimeVersion,
  upgradeEndpointPayload,
  upgradeEngineTargets,
  upgradeInProgress,
  upgradeProgress,
} from "./zcache-upgrade";

function makeCluster({
  requestedId,
  upgrade,
}: {
  requestedId?: string;
  upgrade?: { id: string; phase: string };
}) {
  return {
    metadata: {
      name: "cluster",
      annotations: requestedId
        ? { "neutree.ai/cache-upgrade": JSON.stringify({ id: requestedId }) }
        : {},
    },
    spec: {},
    status: {
      cache: {
        provider: "zcache",
        details: { upgrade: upgrade && { ...upgrade, endpoints: [] } },
      },
    },
  } as unknown as Cluster;
}

describe("effectiveUpgrade", () => {
  it("shows a new request in place of the last reported upgrade", () => {
    const cluster = makeCluster({
      requestedId: "new",
      upgrade: { id: "old", phase: "Succeeded" },
    });
    expect(effectiveUpgrade(cluster)).toEqual({
      id: "new",
      phase: "UpdatingRuntime",
      endpoints: [],
    });
  });

  it("shows the reported upgrade once it answers the request", () => {
    const cluster = makeCluster({
      requestedId: "new",
      upgrade: { id: "new", phase: "Failed" },
    });
    expect(effectiveUpgrade(cluster)?.phase).toBe("Failed");
  });

  it("ignores a malformed request annotation", () => {
    const cluster = makeCluster({ upgrade: { id: "old", phase: "Succeeded" } });
    cluster.metadata.annotations = { "neutree.ai/cache-upgrade": "{" };
    expect(effectiveUpgrade(cluster)?.id).toBe("old");
  });
});

describe("upgradeInProgress", () => {
  it.each([
    { phase: "UpdatingRuntime", busy: true },
    { phase: "Succeeded", busy: false },
    { phase: "Failed", busy: false },
  ])("$phase -> $busy", ({ phase, busy }) => {
    expect(upgradeInProgress({ id: "x", phase, endpoints: [] })).toBe(busy);
  });
});

describe("upgrade actions", () => {
  it.each([
    { engine: "v0.31.0", action: "keep" },
    { engine: "v0.24.0", action: "" },
  ])("defaults $engine to '$action'", ({ engine, action }) => {
    expect(defaultUpgradeAction(engine, ["v0.31.0"])).toBe(action);
  });

  it("offers only supported, installed engine versions other than the current one", () => {
    expect(
      upgradeEngineTargets(
        "v0.31.0",
        ["v0.31.0", "v0.32.0", "v0.33.0"],
        ["v0.31.0", "v0.32.0"],
      ),
    ).toEqual(["v0.32.0"]);
  });

  it.each([
    { action: "keep", engine_version: "", disable_cache: false },
    { action: "disable", engine_version: "", disable_cache: true },
    { action: "v0.32.0", engine_version: "v0.32.0", disable_cache: false },
  ])("submits $action", ({ action, engine_version, disable_cache }) => {
    const endpoint = {
      metadata: {
        name: "ep",
        annotations: { "neutree.ai/resource-spec-signature": "sig" },
      },
    } as unknown as CacheDependentEndpoint;
    expect(upgradeEndpointPayload(endpoint, action)).toEqual({
      name: "ep",
      expected_signature: "sig",
      engine_version,
      disable_cache,
    });
  });
});

describe("upgrade summary", () => {
  const spec = { enabled: true, l1_size_gib: 1, target_nodes: [] };

  it("names the target version only while it differs from the ready one", () => {
    expect(targetRuntimeVersion({ ...spec, version: "v2" }, "v1")).toBe("v2");
    expect(
      targetRuntimeVersion({ ...spec, version: "v1" }, "v1"),
    ).toBeUndefined();
    expect(targetRuntimeVersion(spec, "v1")).toBeUndefined();
  });

  it("starts an upgrade only on an enabled cache with none under way", () => {
    expect(canStartUpgrade(spec)).toBe(true);
    expect(canStartUpgrade({ ...spec, enabled: false })).toBe(false);
    expect(
      canStartUpgrade(spec, {
        id: "u",
        phase: "UpdatingRuntime",
        endpoints: [],
      }),
    ).toBe(false);
  });

  it("reports an unfinished upgrade with each endpoint's progress and link", () => {
    expect(
      upgradeProgress(
        {
          id: "u",
          phase: "Failed",
          endpoints: [{ name: "chat api", phase: "Failed", message: "oom" }],
        },
        null,
      ),
    ).toEqual({
      phaseKey: "clusters.cacheUpgrade.phases.Failed",
      endpoints: [
        {
          name: "chat api",
          href: "/default/endpoints/show/chat%20api",
          phaseKey: "clusters.cacheUpgrade.phases.Failed",
          message: "oom",
        },
      ],
    });
    expect(
      upgradeProgress({ id: "u", phase: "Succeeded", endpoints: [] }, "w"),
    ).toBeUndefined();
  });
});
