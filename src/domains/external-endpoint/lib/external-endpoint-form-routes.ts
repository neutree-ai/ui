import type { UseFormReturn } from "react-hook-form";
import { getExposedModels } from "@/domains/external-endpoint/lib/get-exposed-models";
import type { EditableModelRoute } from "@/domains/external-endpoint/lib/route-strategy";
import { routesFromLegacy } from "@/domains/external-endpoint/lib/routes-from-legacy";
import type {
  ExternalEndpointSpec,
  ModelRoute,
  UpstreamSpec,
} from "@/domains/external-endpoint/types";
import { parseStoredModelSource } from "@/foundation/model-reference/model-source";

type ExternalEndpointForm = Pick<UseFormReturn, "setValue" | "getValues">;

/**
 * A stored route as the form edits it: priority and weighted routes lock their
 * strategy, and priority routes show two tiers (the lowest priority is
 * primary, every other target standby).
 */
export function routeForForm(route: ModelRoute): EditableModelRoute {
  const editable: EditableModelRoute = {
    ...route,
    strategyLocked:
      route.strategy === "priority" || route.strategy === "weighted",
  };
  if (route.strategy !== "priority") return editable;
  const primary = Math.min(
    ...route.targets.map((target) => target.priority ?? 0),
  );
  return {
    ...editable,
    targets: route.targets.map((target) => ({
      ...target,
      priority: (target.priority ?? 0) === primary ? 0 : 1,
    })),
  };
}

/** Drops an upstream from every route's targets, and the routes left without one. */
export function removeRouteUpstream(
  routes: ModelRoute[] | null | undefined,
  upstream: string,
): ModelRoute[] | null | undefined {
  if (!routes) return routes;
  return routes
    .map((route) => ({
      ...route,
      targets: route.targets.filter((target) => target.upstream !== upstream),
    }))
    .filter((route) => route.targets.length > 0);
}

/**
 * The first route problem the submit adapter reports, besides strategy errors:
 * a blank model name, or a repeated model, a route without targets, or a
 * target without upstream or upstream model or naming no upstream row.
 */
export function routeTargetsError(routes: ModelRoute[], upstreams: string[]) {
  const seenModels = new Set<string>();
  const invalid = routes.find((route) => {
    const model = route.model.trim();
    if (!model || seenModels.has(model)) return true;
    seenModels.add(model);
    return (
      !route.targets.length ||
      route.targets.some(
        (target) =>
          !target.upstream.trim() ||
          !target.upstream_model.trim() ||
          !upstreams.includes(target.upstream),
      )
    );
  });
  if (!invalid) return undefined;
  return invalid.model.trim()
    ? "external_endpoints.validation.routeTargetRequired"
    : "external_endpoints.validation.virtualModelRequired";
}

/**
 * Routes as saved: strategy `fixed` unless set, priority 0 unless set, weight
 * 1 outside weighted routes (a weighted route keeps its weights, 0 included),
 * targets renamed from the rows' stored names to their current names, and the
 * form-only `strategyLocked` dropped.
 */
export function routesForSubmit(
  routes: EditableModelRoute[],
  storedNames: string[],
  names: string[],
): ModelRoute[] {
  return routes.map(({ strategyLocked: _strategyLocked, ...route }) => ({
    ...route,
    strategy: route.strategy ?? "fixed",
    targets: route.targets.map((target) => ({
      ...target,
      upstream: names[storedNames.indexOf(target.upstream)] ?? target.upstream,
      priority: target.priority ?? 0,
      weight:
        route.strategy === "weighted" ? target.weight : target.weight || 1,
    })),
  }));
}

/** Gives a legacy spec (no `model_routes`) routes from its upstreams' mappings. */
export function migrateLegacyRoutes(
  form: ExternalEndpointForm,
  routes: ModelRoute[] | null | undefined,
  upstreams: UpstreamSpec[],
) {
  if (routes == null)
    form.setValue("spec.model_routes", routesFromLegacy(upstreams));
}

/** Sets a model's source; a blank value removes it. Nothing happens before the model is named. */
export function setModelSource(
  form: ExternalEndpointForm,
  model: string,
  value: string,
) {
  if (!model) return;
  const next: Record<string, string> = {
    ...((form.getValues(
      "spec.model_sources",
    ) as ExternalEndpointSpec["model_sources"]) ?? {}),
  };
  const source = parseStoredModelSource(value);
  if (source) next[model] = source;
  else delete next[model];
  form.setValue("spec.model_sources", next, { shouldDirty: true });
}

/** Points one route target at an upstream, as the quick-create dialog does for the one it adds. */
export function setRouteTargetUpstream(
  form: ExternalEndpointForm,
  at: { routeIndex: number; targetIndex: number },
  upstream: string,
) {
  const routes: ModelRoute[] = form.getValues("spec.model_routes") ?? [];
  form.setValue(
    "spec.model_routes",
    routes.map((route, index) =>
      index === at.routeIndex
        ? {
            ...route,
            targets: route.targets.map((target, index) =>
              index === at.targetIndex ? { ...target, upstream } : target,
            ),
          }
        : route,
    ),
    { shouldDirty: true, shouldValidate: true },
  );
}

/**
 * What model-source suggestions draw on. This form's own assignments for the
 * models it currently has: without them a value typed for the first model is
 * not offered for the second, where retyping it slightly differently would
 * fragment the set. Sibling endpoints count only for the models they still
 * serve: a value whose last user is gone is not worth suggesting.
 */
export const modelSourceUsage = (
  modelSources: ExternalEndpointSpec["model_sources"],
  routes: ModelRoute[],
  siblings: (ExternalEndpointSpec | null)[],
) => [
  { modelSources, models: routes.map((route) => route.model) },
  ...siblings.map((spec) => ({
    modelSources: spec?.model_sources,
    models: getExposedModels(spec),
  })),
];
