import type { ModelRoute } from "../types";

export type RouteStrategy = NonNullable<ModelRoute["strategy"]>;

// Form-only origin, carried with the row through renames and deletions.
// Removed by the form's submission adapter; never part of the API contract.
export type EditableModelRoute = ModelRoute & {
  strategyLocked?: boolean;
};

export function changeRouteStrategy(
  route: EditableModelRoute,
  strategy: RouteStrategy,
  defaultUpstream: string,
) {
  if (route.strategyLocked || (route.strategy ?? "fixed") === strategy)
    return route;

  let targets = route.targets.length
    ? route.targets
    : [{ upstream: defaultUpstream, upstream_model: "" }];
  if (strategy === "fixed") targets = targets.slice(0, 1);
  else if (targets.length === 1)
    targets = [...targets, { upstream: "", upstream_model: "" }];

  return {
    ...route,
    strategy,
    targets: targets.map((target, index) => ({
      ...target,
      priority: strategy === "priority" && index > 0 ? 1 : 0,
      weight: undefined,
      max_inflight_requests:
        strategy === "weighted" ? undefined : target.max_inflight_requests,
    })),
  };
}
