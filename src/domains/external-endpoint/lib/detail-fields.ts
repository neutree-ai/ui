import { formatTimeout } from "@/domains/external-endpoint/lib/convert-timeout";
import { getEndpointType } from "@/domains/external-endpoint/lib/get-endpoint-type";
import { getExposedModels } from "@/domains/external-endpoint/lib/get-exposed-models";
import type { ExternalEndpoint } from "@/domains/external-endpoint/types";
import { type DetailField, field } from "@/foundation/scene/detail-field";

const TYPE_KEYS = {
  external: "external_endpoints.options.upstreamTypeExternal",
  endpoint_ref: "external_endpoints.options.upstreamTypeInternal",
  mixed: "external_endpoints.options.upstreamTypeMixed",
} as const;

export const externalEndpointHeaderFields: DetailField<ExternalEndpoint>[] = [
  field("external_endpoints.fields.type", (endpoint, t) => {
    const type = getEndpointType(endpoint.spec);
    return type && t(TYPE_KEYS[type]);
  }),
  field(
    "external_endpoints.fields.models",
    (endpoint) => getExposedModels(endpoint.spec).length,
  ),
  field("external_endpoints.fields.timeout", {
    render: (endpoint) => formatTimeout(endpoint.spec?.timeout),
  }),
];
