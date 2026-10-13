import { describe, expect, it } from "vitest";
import { changeRouteStrategy, type EditableModelRoute } from "./route-strategy";

describe("route strategy conversion", () => {
  it("normalizes configured targets and primary/standby roles immediately", () => {
    const route: EditableModelRoute = {
      model: "chat",
      strategy: "priority",
      targets: [
        {
          upstream: "a",
          upstream_model: "m",
          priority: 0,
          max_inflight_requests: 7,
        },
        { upstream: "b", upstream_model: "backup", priority: 1 },
      ],
    };
    const weighted = changeRouteStrategy(route, "weighted", "a");
    expect(weighted.route.targets).toEqual(
      route.targets.map((target) => ({
        ...target,
        priority: 0,
        weight: undefined,
        max_inflight_requests: undefined,
      })),
    );
    const fixed = changeRouteStrategy(route, "fixed", "a");
    expect(fixed.route.targets).toEqual([
      { ...route.targets[0], weight: undefined },
    ]);
    expect(route.targets).toHaveLength(2);
    expect(route.targets[0].max_inflight_requests).toBe(7);
  });

  it("clears weights and assigns primary/standby tiers on conversion", () => {
    const route: EditableModelRoute = {
      model: "chat",
      strategy: "weighted",
      targets: [
        { upstream: "a", upstream_model: "a", weight: 30 },
        { upstream: "b", upstream_model: "b", weight: 30 },
        { upstream: "c", upstream_model: "c", weight: 40 },
      ],
    };
    const next = changeRouteStrategy(route, "priority", "a");
    expect(
      next.route.targets.map(({ priority, weight }) => ({ priority, weight })),
    ).toEqual([
      { priority: 0, weight: undefined },
      { priority: 1, weight: undefined },
      { priority: 1, weight: undefined },
    ]);
  });

  it("treats same-strategy callbacks as no-ops and leaves saved multi-target routes untouched", () => {
    for (const strategy of ["fixed", "priority", "weighted"] as const) {
      const route: EditableModelRoute = {
        model: "chat",
        strategy,
        targets: [
          {
            upstream: "a",
            upstream_model: "m",
            weight: 100,
            max_inflight_requests: 5,
          },
        ],
      };
      expect(changeRouteStrategy(route, strategy, "a").route).toBe(route);
      if (strategy === "fixed") continue;
      route.strategyLocked = true;
      for (const next of ["fixed", "priority", "weighted"] as const)
        expect(changeRouteStrategy(route, next, "a").route).toBe(route);
    }
  });
});
