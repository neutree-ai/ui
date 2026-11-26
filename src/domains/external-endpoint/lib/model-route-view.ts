import type { TFunction } from "i18next";
import {
  type ModelSourceMap,
  parseStoredModelSource,
} from "@/foundation/model-reference/model-source";
import type { ModelRoute, ModelRouteTarget } from "../types";
import type { RouteStrategy } from "./route-strategy";

/** A route stored without a strategy is a fixed route. */
export const routeStrategyOf = (route: Pick<ModelRoute, "strategy">) =>
  route.strategy ?? "fixed";

/** Each strategy's label and hint, in the order the editor offers them. */
export const ROUTE_STRATEGY_TEXT = {
  fixed: {
    label: "external_endpoints.options.fixedRouting",
    hint: "external_endpoints.messages.fixedRoutingHint",
  },
  priority: {
    label: "external_endpoints.options.priorityRouting",
    hint: "external_endpoints.messages.priorityRoutingHint",
  },
  weighted: {
    label: "external_endpoints.options.weightedRouting",
    hint: "external_endpoints.messages.weightedRoutingHint",
  },
} as const satisfies Record<RouteStrategy, { label: string; hint: string }>;

/** The editor card's index of the route serving `model`, -1 when none does. */
export const routeIndexOfModel = (routes: ModelRoute[], model?: string) =>
  routes.findIndex((route) => route.model === model);

/** The editor card's title model: the route's model, or "unnamed" until one is typed. */
export const routeCardModel = (route: ModelRoute, t: TFunction) =>
  route.model || t("external_endpoints.messages.unnamedModel");

/** A source is chosen per model, so a route takes one only once it is named. */
export const canChooseModelSource = (route: ModelRoute) => !!route.model;

/** The source chosen for the route's model, "" while none is. */
export const routeModelSource = (sources: ModelSourceMap, route: ModelRoute) =>
  parseStoredModelSource(sources?.[route.model]) ?? "";

/** The editor's weight total: an unset weight counts 0, as validation counts it. */
export const routeWeightTotal = (route: ModelRoute) =>
  route.targets.reduce((sum, target) => sum + (target.weight ?? 0), 0);

/** The editor's priority tiers by target index: priority 0 (or unset) is primary, above it fallback. */
export function priorityTargetIndices(route: ModelRoute) {
  const tier = (inTier: (priority: number) => boolean) =>
    route.targets.flatMap((target, index) =>
      inTier(target.priority ?? 0) ? [index] : [],
    );
  return {
    primary: tier((priority) => priority === 0),
    fallback: tier((priority) => priority > 0),
  };
}

/** A target can be removed unless it is the route's last target or a priority route's last primary target. */
export function canRemoveTarget(route: ModelRoute, index: number) {
  if (route.targets.length <= 1) return false;
  if (routeStrategyOf(route) !== "priority") return true;
  const { primary } = priorityTargetIndices(route);
  return !(primary.includes(index) && primary.length <= 1);
}

/** A blank target added to a route; a priority route places it in the requested tier. */
export function newRouteTarget(strategy: RouteStrategy, primary: boolean) {
  const target: ModelRouteTarget = { upstream: "", upstream_model: "" };
  if (strategy === "priority") target.priority = primary ? 0 : 1;
  return target;
}

/** The provider option a target routes to. */
export const targetProvider = <P extends { value: string }>(
  providers: P[],
  target: ModelRouteTarget,
) => providers.find((provider) => provider.value === target.upstream);

type TargetNumberField = "weight" | "max_inflight_requests";

/** A number input's value for a target's optional number: empty while unset. */
export const targetNumberValue = (
  target: ModelRouteTarget,
  field: TargetNumberField,
) => target[field] ?? "";

/** The target with an optional number taken from its input: an emptied input unsets it. */
export const withTargetNumber = (
  target: ModelRouteTarget,
  field: TargetNumberField,
  input: { value: string; valueAsNumber: number },
): ModelRouteTarget => ({
  ...target,
  [field]: input.value === "" ? undefined : input.valueAsNumber,
});

/**
 * The detail card's target rows. A weighted target shows its share of the
 * route's traffic (an unset weight counts 1, as the gateway defaults it); in a
 * priority route the lowest priority is primary and the rest are fallbacks; an
 * unset or zero in-flight cap is unlimited.
 */
export function routeTargetRows(route: ModelRoute) {
  const strategy = routeStrategyOf(route);
  const totalWeight = route.targets.reduce(
    (sum, target) => sum + (target.weight ?? 1),
    0,
  );
  const primaryPriority = Math.min(
    ...route.targets.map((target) => target.priority ?? 0),
  );
  return route.targets.map((target, index) => ({
    key: `${target.upstream}-${target.upstream_model}-${index}`,
    upstream: target.upstream,
    upstreamModel: target.upstream_model || undefined,
    role:
      strategy !== "priority"
        ? undefined
        : (target.priority ?? 0) === primaryPriority
          ? ("primary" as const)
          : ("fallback" as const),
    weightShare: Number(
      (((target.weight ?? 1) / totalWeight) * 100).toFixed(2),
    ),
    maxInflight: target.max_inflight_requests || undefined,
  }));
}
