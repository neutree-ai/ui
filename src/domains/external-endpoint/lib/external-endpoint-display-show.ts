import type { ExternalEndpoint, UpstreamSpec, UpstreamStatus } from "../types";
import { getExposedModels } from "./get-exposed-models";
import { getUnavailableModels } from "./get-unavailable-models";
import { getUpstreamModelMappings } from "./get-upstream-model-mappings";
import { isServingPhase } from "./is-serving-phase";
import { matchUpstreamStatuses } from "./match-upstream-statuses";
import { routesFromLegacy, upstreamNameAt } from "./routes-from-legacy";

/**
 * What the detail page reads from its endpoint. Routes fall back to the legacy
 * upstream mappings, but only stored routes have routing metrics to monitor.
 * The curl example appears only while the endpoint serves, and offers only the
 * models no failed upstream dropped: a degraded endpoint still serves.
 */
export function externalEndpointShowView(record: ExternalEndpoint) {
  const upstreams = record.spec?.upstreams ?? [];
  const statuses = matchUpstreamStatuses(
    record.spec,
    record.status?.upstream_status,
  );
  const unavailable = getUnavailableModels(statuses);
  const serviceUrl = record.status?.service_url || undefined;
  return {
    serviceUrl,
    exampleServiceUrl: isServingPhase(record.status?.phase)
      ? serviceUrl
      : undefined,
    callableModels: getExposedModels(record.spec).filter(
      (model) => !unavailable.has(model),
    ),
    routes: record.spec?.model_routes ?? routesFromLegacy(upstreams),
    monitorsRoutes: !!record.spec?.model_routes?.length,
    upstreams: upstreams.map((upstream, index) =>
      upstreamCard(record, upstream, index, statuses[index], unavailable),
    ),
  };
}

/**
 * One model-service card: its name (`provider-N` while unnamed), whether it
 * points at an internal endpoint or an external URL, its status, the models it
 * maps and, when it failed, its `failure`.
 */
function upstreamCard(
  record: ExternalEndpoint,
  upstream: UpstreamSpec,
  index: number,
  status: UpstreamStatus | null,
  unavailable: Set<string>,
) {
  const mappings = getUpstreamModelMappings(record.spec, upstream);
  return {
    name: upstreamNameAt(upstream, index),
    internal: !!upstream.endpoint_ref,
    reference: upstream.endpoint_ref || upstream.upstream?.url || undefined,
    status,
    failure:
      status?.phase === "Failed" ? upstreamFailure(status, unavailable) : null,
    mappings,
    exposedCount: new Set(mappings.flatMap((mapping) => mapping.exposedModels))
      .size,
  };
}

/**
 * What a failed upstream's alert lists: its models no other ready upstream
 * still serves. `servedByOther` when it had models and all of them still are.
 */
function upstreamFailure(status: UpstreamStatus, unavailable: Set<string>) {
  const models = status.models ?? [];
  const dropped = models.filter((model) => unavailable.has(model));
  return {
    models: dropped,
    servedByOther: models.length > 0 && dropped.length === 0,
  };
}
