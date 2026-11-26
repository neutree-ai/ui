import type { UseFormReturn } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import { makeRoute, makeTarget } from "../testing/fixtures";
import {
  removeRouteUpstream,
  routeForForm,
  routesForSubmit,
  routeTargetsError,
  setModelSource,
} from "./external-endpoint-form-routes";

describe("routeForForm", () => {
  it.each([
    { strategy: "fixed" as const, priorities: [0], locked: false, tiers: [0] },
    {
      strategy: "weighted" as const,
      priorities: [0, 0],
      locked: true,
      tiers: [0, 0],
    },
    {
      strategy: "priority" as const,
      priorities: [1, 2, 3],
      locked: true,
      tiers: [0, 1, 1],
    },
    {
      strategy: "priority" as const,
      priorities: [20, 10, 10],
      locked: true,
      tiers: [1, 0, 0],
    },
  ])(
    "loads $strategy priorities $priorities as tiers $tiers, locked: $locked",
    ({ strategy, priorities, locked, tiers }) => {
      const loaded = routeForForm(
        makeRoute({
          strategy,
          targets: priorities.map((priority) => makeTarget({ priority })),
        }),
      );
      expect(loaded.strategyLocked).toBe(locked);
      expect(loaded.targets.map((t) => t.priority)).toEqual(tiers);
    },
  );
});

describe("removeRouteUpstream", () => {
  it("drops the upstream's targets and the routes left without one", () => {
    const routes = [
      makeRoute({
        model: "kept",
        targets: [makeTarget(), makeTarget({ upstream: "b" })],
      }),
      makeRoute({ model: "gone" }),
    ];
    expect(removeRouteUpstream(routes, "a")).toEqual([
      makeRoute({ model: "kept", targets: [makeTarget({ upstream: "b" })] }),
    ]);
  });
});

describe("routeTargetsError", () => {
  const TARGET = "external_endpoints.validation.routeTargetRequired";
  it.each([
    { name: "a valid route", routes: [makeRoute()], error: undefined },
    {
      name: "a blank model",
      routes: [makeRoute({ model: " " })],
      error: "external_endpoints.validation.virtualModelRequired",
    },
    {
      name: "a repeated model",
      routes: [makeRoute(), makeRoute({ model: " chat " })],
      error: TARGET,
    },
    { name: "no targets", routes: [makeRoute({ targets: [] })], error: TARGET },
    {
      name: "a blank upstream",
      routes: [makeRoute({ targets: [makeTarget({ upstream: " " })] })],
      error: TARGET,
    },
    {
      name: "a blank upstream model",
      routes: [makeRoute({ targets: [makeTarget({ upstream_model: "" })] })],
      error: TARGET,
    },
    {
      name: "an unknown upstream",
      routes: [makeRoute({ targets: [makeTarget({ upstream: "gone" })] })],
      error: TARGET,
    },
  ])("$name -> $error", ({ routes, error }) => {
    expect(routeTargetsError(routes, ["a"])).toBe(error);
  });
});

describe("routesForSubmit", () => {
  it.each([
    {
      strategy: undefined,
      weight: undefined,
      saved: { strategy: "fixed", weight: 1 },
    },
    { strategy: null, weight: 0, saved: { strategy: "fixed", weight: 1 } },
    {
      strategy: "priority" as const,
      weight: undefined,
      saved: { strategy: "priority", weight: 1 },
    },
    {
      strategy: "weighted" as const,
      weight: 0,
      saved: { strategy: "weighted", weight: 0 },
    },
  ])(
    "saves strategy $strategy with weight $weight as $saved",
    ({ strategy, weight, saved }) => {
      const [route] = routesForSubmit(
        [
          makeRoute({
            strategy,
            targets: [makeTarget({ priority: undefined, weight })],
          }),
        ],
        [],
        [],
      );
      expect(route.strategy).toBe(saved.strategy);
      expect(route.targets[0]).toMatchObject({
        priority: 0,
        weight: saved.weight,
      });
    },
  );

  it("renames targets from stored to current names and drops strategyLocked", () => {
    const [route] = routesForSubmit(
      [
        {
          ...makeRoute({
            targets: [
              makeTarget({ upstream: "old" }),
              makeTarget({ upstream: "x" }),
            ],
          }),
          strategyLocked: true,
        },
      ],
      ["old"],
      ["new"],
    );
    expect(route).not.toHaveProperty("strategyLocked");
    expect(route.targets.map((t) => t.upstream)).toEqual(["new", "x"]);
  });
});

describe("setModelSource", () => {
  const form = (sources: Record<string, string>) =>
    ({
      getValues: () => sources,
      setValue: vi.fn(),
    }) as unknown as Pick<UseFormReturn, "setValue" | "getValues"> & {
      setValue: ReturnType<typeof vi.fn>;
    };

  it.each([
    { value: " lab ", saved: { chat: "lab", other: "x" } },
    { value: " ", saved: { other: "x" } },
  ])("stores $value as $saved", ({ value, saved }) => {
    const f = form({ chat: "old", other: "x" });
    setModelSource(f, "chat", value);
    expect(f.setValue).toHaveBeenCalledWith("spec.model_sources", saved, {
      shouldDirty: true,
    });
  });

  it("ignores a source typed before the model is named", () => {
    const f = form({});
    setModelSource(f, "", "lab");
    expect(f.setValue).not.toHaveBeenCalled();
  });
});
