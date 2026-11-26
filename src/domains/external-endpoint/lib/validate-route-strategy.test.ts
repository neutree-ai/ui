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
    { name: "weighted 0/100", route: weighted(0, 100), error: undefined },
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
    { limit: undefined, error: undefined },
    { limit: 0, error: undefined },
    { limit: 1, error: undefined },
    { limit: 2147483647, error: undefined },
    ...[-1, 1.5, 2147483648, Number.NaN].map((limit) => ({
      limit,
      error: "external_endpoints.messages.maxInflightRequestsInvalid",
    })),
  ])("concurrency limit $limit -> $error", ({ limit, error }) => {
    expect(getRouteStrategyError(priority([0, limit], [1, undefined]))).toBe(
      error,
    );
    expect(getRouteStrategyError(priority([0, 1], [1, limit]))).toBe(error);
    expect(
      getRouteStrategyError(
        makeRoute({ targets: [makeTarget({ max_inflight_requests: limit })] }),
      ),
    ).toBe(error);
  });

  it("ignores concurrency limits on weighted routes, which offer none", () => {
    expect(
      getRouteStrategyError(
        makeRoute({
          strategy: "weighted",
          targets: [makeTarget({ weight: 100, max_inflight_requests: -1 })],
        }),
      ),
    ).toBeUndefined();
  });

  it("requires a primary target for priority routing", () => {
    expect(getRouteStrategyError(priority([1, 1]))).toBe(
      "external_endpoints.messages.primaryTargetRequired",
    );
  });
});
