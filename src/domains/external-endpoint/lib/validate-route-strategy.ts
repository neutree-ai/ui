import type { ModelRoute } from "../types";

// Shared by inline feedback, save availability, and the submission guard.
export function getRouteStrategyError(route: ModelRoute) {
  if (route.strategy === "weighted") {
    if (
      route.targets.some(
        ({ weight }) =>
          !Number.isInteger(weight) || (weight ?? 0) < 1 || (weight ?? 0) > 100,
      )
    )
      return "external_endpoints.messages.weightRequired";
    if (
      route.targets.reduce((sum, target) => sum + (target.weight ?? 0), 0) !==
      100
    )
      return "external_endpoints.messages.weightTotalInvalid";
  }
  if (route.strategy === "priority") {
    const primary = route.targets.filter(
      (target) => (target.priority ?? 0) === 0,
    );
    if (!primary.length)
      return "external_endpoints.messages.primaryTargetRequired";
    if (
      primary.some(
        ({ max_inflight_requests: limit }) =>
          !Number.isInteger(limit) ||
          (limit ?? 0) < 1 ||
          (limit ?? 0) > 2147483647,
      )
    )
      return "external_endpoints.messages.primaryCapacityRequired";
  }
}
