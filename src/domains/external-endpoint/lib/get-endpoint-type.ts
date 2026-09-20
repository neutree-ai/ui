import type { ExternalEndpointSpec } from "@/domains/external-endpoint/types";

export type ExternalEndpointType = "external" | "endpoint_ref" | "mixed";

export function getEndpointType(
  spec: ExternalEndpointSpec | null,
): ExternalEndpointType | null {
  if (!spec?.upstreams?.length) return null;

  const hasExternal = spec.upstreams.some((u) => !u.endpoint_ref);
  const hasEndpointRef = spec.upstreams.some((u) => !!u.endpoint_ref);

  if (hasExternal && hasEndpointRef) return "mixed";
  if (hasEndpointRef) return "endpoint_ref";
  return "external";
}
