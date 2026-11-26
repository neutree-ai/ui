import { describe, expect, it } from "vitest";
import type { ZCacheStatus } from "../types";
import {
  readyNodeCount,
  zcacheNodeChoices,
  zcacheNodeDetails,
} from "./zcache-nodes";

const node = (
  name: string,
  gib: number,
  runtime = "Ready",
  reason?: string,
) => ({
  name,
  runtime,
  cache: "Available",
  capacity_bytes: gib * 2 ** 30,
  reason,
});

const status: ZCacheStatus = {
  candidates: [
    { name: "a", selectable: true },
    { name: "b", selectable: false, reason: "no GPU" },
    { name: "c", selectable: true },
    {
      name: "cp",
      selectable: false,
      reason:
        "control-plane nodes are not used for the ZCache runtime by default",
    },
  ],
  nodes: [node("a", 8), node("b", 0, "NotReady", "zcache pod crashed")],
};

const choices = (
  s: ZCacheStatus,
  draft: Partial<Parameters<typeof zcacheNodeChoices>[1]> = {},
) =>
  Object.fromEntries(
    zcacheNodeChoices(s, {
      selected: ["a", "b"],
      saved: ["a", "b"],
      guardRemoval: false,
      ...draft,
    }).map((row) => [row.name, row]),
  );

describe("zcacheNodeChoices", () => {
  it("lists candidates and selected nodes with their runtime, reason and capacity", () => {
    const rows = choices(status, { selected: ["a", "gone"] });
    expect(Object.keys(rows)).toEqual(["a", "b", "c", "cp", "gone"]);
    expect(rows.a).toMatchObject({ runtime: "ready", capacityGiB: "8" });
    expect(rows.b).toMatchObject({
      runtime: "notReady",
      reason: "zcache pod crashed",
      capacityGiB: null,
    });
    expect(rows.c).toMatchObject({ runtime: "eligible", reason: undefined });
    expect(rows.cp).toMatchObject({
      runtime: "unavailable",
      reasonKey: "clusters.zcache.kubernetesControlPlane",
      reason: undefined,
    });
  });

  it("locks applied nodes while in use, but not a saved node never applied", () => {
    const rows = choices(
      {
        ...status,
        current: { enabled: true, l1_size_gib: 8, target_nodes: ["a"] },
      },
      { guardRemoval: true },
    );
    expect(rows.a).toMatchObject({ applied: true, locked: true });
    expect(rows.b).toMatchObject({ applied: false, locked: false });
    expect(rows.c.locked).toBe(false);
  });

  it("falls back to the saved nodes until the service reports applied ones", () => {
    expect(choices(status, { guardRemoval: true }).b.locked).toBe(true);
  });

  it("blocks adding unselectable nodes or any node from a failed observation", () => {
    expect(choices(status).cp.locked).toBe(true);
    const stale = choices({ ...status, observation_error: "unreachable" });
    expect(stale.c.locked).toBe(true);
    expect(stale.a.locked).toBe(false);
  });
});

describe("zcacheNodeDetails", () => {
  const desired = { enabled: true, l1_size_gib: 8, target_nodes: ["a", "new"] };
  const rows = (
    stale = false,
    usage?: Parameters<typeof zcacheNodeDetails>[3],
  ) =>
    Object.fromEntries(
      zcacheNodeDetails(
        desired,
        { nodes: [node("a", 8), node("old", 2, "NotReady", "draining")] },
        stale,
        usage,
      ).map((row) => [row.name, row]),
    );

  it("lists reported and target nodes, marking pending and removed ones", () => {
    const { a, old, new: pending } = rows();
    expect(a).toMatchObject({
      runtimeKey: "clusters.zcache.ready",
      reason: undefined,
      target: true,
      capacityLabel: "8",
      targetGiB: undefined,
    });
    expect(old).toMatchObject({
      runtimeKey: "clusters.zcache.notReady",
      reason: "draining",
      target: false,
    });
    expect(pending).toMatchObject({
      runtimeKey: "clusters.zcache.pendingNode",
      capacityLabel: null,
      targetGiB: 8,
    });
  });

  it("shows usage against the metrics' capacity, clamped to 100%", () => {
    const { a, old } = rows(false, {
      a: { usedGiB: 3.4, capacityGiB: 8 },
      old: { usedGiB: 5, capacityGiB: 4 },
    });
    expect(a).toMatchObject({
      usedLabel: "3.4",
      capacityLabel: "8",
      percent: 43,
    });
    expect(old).toMatchObject({ capacityLabel: "4", percent: 100 });
  });

  it("reports neither readiness nor usage from a stale observation", () => {
    const { a } = rows(true, { a: { usedGiB: 3, capacityGiB: 8 } });
    expect(a).toMatchObject({
      runtimeKey: "clusters.zcache.unknown",
      usedLabel: null,
      capacityLabel: "8",
      percent: null,
    });
  });

  it("lists no target nodes while the cache is disabled", () => {
    const names = zcacheNodeDetails(
      { ...desired, enabled: false },
      { nodes: [node("a", 8)] },
      false,
    ).map((row) => row.name);
    expect(names).toEqual(["a"]);
  });
});

it("counts ready nodes", () => {
  expect(readyNodeCount(status)).toBe(1);
  expect(readyNodeCount(undefined)).toBe(0);
});
