import { describe, expect, it } from "vitest";
import {
  type CacheDependentEndpoint,
  cacheDependents,
  nodeSelectionState,
} from "./zcache-node-selection";

const endpoint = (
  overrides: Partial<CacheDependentEndpoint>,
): CacheDependentEndpoint => ({ id: 1, name: "ep", ...overrides });

describe("cacheDependents", () => {
  it("lists endpoints that configure or are reported using the cache, once each", () => {
    expect(
      cacheDependents([
        endpoint({ name: "configured", kv_cache: { provider: "zcache" } }),
        endpoint({
          name: "using",
          display_name: "Using",
          observed_kv_cache: { provider: "zcache", details: { in_use: true } },
        }),
        endpoint({
          name: "idle",
          observed_kv_cache: { provider: "zcache", details: { in_use: false } },
        }),
        endpoint({ name: "other", kv_cache: { provider: "lmcache" } }),
        endpoint({ id: 7, name: null, kv_cache: { provider: "zcache" } }),
        endpoint({ name: "configured", kv_cache: { provider: "zcache" } }),
      ]),
    ).toEqual(["configured", "Using", "7"]);
  });
});

describe("nodeSelectionState", () => {
  const idle = { inUse: false, loading: false, error: false };
  const base = {
    nodeName: "a",
    selected: ["a"],
    applied: ["a"],
    selectable: true,
    inventoryStale: false,
    dependencies: idle,
  };

  it.each([
    { case: "applied, no dependents", input: {}, disabled: false },
    {
      case: "applied, in use",
      input: { dependencies: { ...idle, inUse: true } },
      disabled: true,
    },
    {
      case: "applied, check loading",
      input: { dependencies: { ...idle, loading: true } },
      disabled: true,
    },
    {
      case: "applied, check failed",
      input: { dependencies: { ...idle, error: true } },
      disabled: true,
    },
    {
      case: "saved but never applied, in use",
      input: { applied: [], dependencies: { ...idle, inUse: true } },
      disabled: false,
    },
    {
      case: "new selectable candidate",
      input: { selected: [], applied: [] },
      disabled: false,
    },
    {
      case: "new unselectable candidate",
      input: { selected: [], applied: [], selectable: false },
      disabled: true,
    },
    {
      case: "new candidate from stale inventory",
      input: { selected: [], applied: [], inventoryStale: true },
      disabled: true,
    },
    {
      case: "selected node from stale inventory",
      input: { applied: [], selectable: false, inventoryStale: true },
      disabled: false,
    },
  ])("$case -> disabled: $disabled", ({ input, disabled }) => {
    expect(nodeSelectionState({ ...base, ...input }).disabled).toBe(disabled);
  });

  it.each([
    { applied: ["a"], deps: { ...idle, inUse: true }, shown: true },
    { applied: ["a"], deps: { ...idle, error: true }, shown: true },
    { applied: ["a"], deps: { ...idle, loading: true }, shown: false },
    { applied: [], deps: { ...idle, inUse: true }, shown: false },
  ])(
    "applied $applied with $deps -> lists dependents: $shown",
    ({ applied, deps, shown }) => {
      expect(
        nodeSelectionState({ ...base, applied, dependencies: deps })
          .showDependents,
      ).toBe(shown);
    },
  );
});
