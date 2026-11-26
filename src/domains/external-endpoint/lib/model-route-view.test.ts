import { describe, expect, it } from "vitest";
import { makeRoute, makeTarget } from "../testing/fixtures";
import {
  canRemoveTarget,
  newRouteTarget,
  priorityTargetIndices,
  routeTargetRows,
  routeWeightTotal,
  targetNumberValue,
  withTargetNumber,
} from "./model-route-view";

const weights = (...values: (number | undefined)[]) =>
  makeRoute({
    strategy: "weighted",
    targets: values.map((weight) => makeTarget({ weight })),
  });

describe("routeTargetRows", () => {
  it.each([
    { weights: [5, 5], shares: [50, 50] },
    { weights: [0, 100], shares: [0, 100] },
    { weights: [undefined, 3], shares: [25, 75] },
    { weights: [1, 2], shares: [33.33, 66.67] },
  ])("weights $weights -> shares $shares", ({ weights: w, shares }) => {
    expect(
      routeTargetRows(weights(...w)).map((row) => row.weightShare),
    ).toEqual(shares);
  });

  it("names the lowest priority primary, whatever the order", () => {
    const rows = routeTargetRows(
      makeRoute({
        strategy: "priority",
        targets: [20, 10, 10].map((priority) => makeTarget({ priority })),
      }),
    );
    expect(rows.map((row) => row.role)).toEqual([
      "fallback",
      "primary",
      "primary",
    ]);
  });

  it("gives no role outside priority routing and reads a zero cap as unlimited", () => {
    const [row] = routeTargetRows(
      makeRoute({
        strategy: undefined,
        targets: [makeTarget({ max_inflight_requests: 0, upstream_model: "" })],
      }),
    );
    expect(row).toMatchObject({
      role: undefined,
      maxInflight: undefined,
      upstreamModel: undefined,
    });
  });
});

describe("editor route rules", () => {
  it("keeps a route's last target and a priority route's last primary target", () => {
    const priority = (...tiers: number[]) =>
      makeRoute({
        strategy: "priority",
        targets: tiers.map((priority) => makeTarget({ priority })),
      });
    expect(canRemoveTarget(makeRoute(), 0)).toBe(false);
    expect(canRemoveTarget(weights(50, 50), 0)).toBe(true);
    expect([0, 1].map((i) => canRemoveTarget(priority(0, 1), i))).toEqual([
      false,
      true,
    ]);
    expect(canRemoveTarget(priority(0, 0, 1), 0)).toBe(true);
  });

  it("counts an unset weight as 0 in the editor total", () => {
    expect(routeWeightTotal(weights(undefined, 40, 0))).toBe(40);
  });

  it("splits targets into primary (priority 0 or unset) and fallback tiers", () => {
    const route = makeRoute({
      strategy: "priority",
      targets: [
        makeTarget({ priority: 1 }),
        makeTarget({ priority: undefined }),
        makeTarget({ priority: 0 }),
      ],
    });
    expect(priorityTargetIndices(route)).toEqual({
      primary: [1, 2],
      fallback: [0],
    });
  });

  it.each([
    { strategy: "priority", primary: true, priority: 0 },
    { strategy: "priority", primary: false, priority: 1 },
    { strategy: "weighted", primary: false, priority: undefined },
  ] as const)(
    "a new $strategy target (primary $primary) has priority $priority",
    ({ strategy, primary, priority }) => {
      expect(newRouteTarget(strategy, primary).priority).toBe(priority);
    },
  );

  it("unsets a number when its input is emptied, keeps an explicit 0", () => {
    const target = makeTarget({ weight: 30 });
    const cleared = withTargetNumber(target, "weight", {
      value: "",
      valueAsNumber: Number.NaN,
    });
    expect(cleared.weight).toBeUndefined();
    expect(targetNumberValue(cleared, "weight")).toBe("");
    const zero = withTargetNumber(target, "weight", {
      value: "0",
      valueAsNumber: 0,
    });
    expect(targetNumberValue(zero, "weight")).toBe(0);
  });
});
