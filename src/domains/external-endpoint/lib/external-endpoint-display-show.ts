import type { ExternalEndpoint, UpstreamSpec, UpstreamStatus } from "../types";
import { getExposedModels } from "./get-exposed-models";
import { getUnavailableModels } from "./get-unavailable-models";
import { getUpstreamModelMappings } from "./get-upstream-model-mappings";
import { isServingPhase } from "./is-serving-phase";
import { matchUpstreamStatuses } from "./match-upstream-statuses";
import { routesFromLegacy } from "./routes-from-legacy";

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
      upstreamCard(record, upstream, index, statuses[index]),
    ),
  };
}

/**
 * One model-service card: its name (`provider-N` while unnamed), whether it
 * points at an internal endpoint or an external URL, its status (also
 * as `failedStatus` when it failed) and the models it maps.
 */
function upstreamCard(
  record: ExternalEndpoint,
  upstream: UpstreamSpec,
  index: number,
  status: UpstreamStatus | null,
) {
  const mappings = getUpstreamModelMappings(record.spec, upstream);
  return {
    name: upstream.name || `provider-${index + 1}`,
    internal: !!upstream.endpoint_ref,
    reference: upstream.endpoint_ref || upstream.upstream?.url || undefined,
    status,
    failedStatus: status?.phase === "Failed" ? status : null,
    mappings,
    exposedCount: new Set(mappings.flatMap((mapping) => mapping.exposedModels))
      .size,
  };
}
