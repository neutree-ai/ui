import { describe, expect, it } from "vitest";
import { makeRoute, makeTarget } from "../testing/fixtures";
import { getRouteStrategyError } from "./validate-route-strategy";

const weighted = (...weights: (number | undefined)[]) =>
  makeRoute({
    strategy: "weighted",
    targets: weights.map((weight) => makeTarget({ weight })),
  });

const priority = (...targets: [number, number | undefined][]) =>
  makeRoute({
    strategy: "priority",
    targets: targets.map(([tier, limit]) =>
      makeTarget({ priority: tier, max_inflight_requests: limit }),
    ),
  });

describe("getRouteStrategyError", () => {
  it.each([
    { name: "fixed", route: makeRoute(), error: undefined },
    { name: "weighted 70/30", route: weighted(70, 30), error: undefined },
    {
      name: "weighted 70/70",
      route: weighted(70, 70),
      error: "external_endpoints.messages.weightTotalInvalid",
    },
    {
      name: "weighted 5/5",
      route: weighted(5, 5),
      error: "external_endpoints.messages.weightTotalInvalid",
    },
    ...[
      [100, undefined],
      [100, 0],
      [50.5, 49.5],
      [101, -1],
      [100, Number.NaN],
    ].map((weights) => ({
      name: `weighted ${weights.join("/")}`,
      route: weighted(...weights),
      error: "external_endpoints.messages.weightRequired",
    })),
  ])("$name -> $error", ({ route, error }) => {
    expect(getRouteStrategyError(route)).toBe(error);
  });

  it.each([
    { limit: 1, error: undefined },
    { limit: 2147483647, error: undefined },
    ...[undefined, 0, -1, 1.5, 2147483648].map((limit) => ({
      limit,
      error: "external_endpoints.messages.primaryCapacityRequired",
    })),
  ])("primary capacity $limit -> $error", ({ limit, error }) => {
    expect(getRouteStrategyError(priority([0, limit], [1, undefined]))).toBe(
      error,
    );
  });

  it("requires a primary target for priority routing", () => {
    expect(getRouteStrategyError(priority([1, 1]))).toBe(
      "external_endpoints.messages.primaryTargetRequired",
    );
  });
});
