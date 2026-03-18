import type { UpstreamSpec } from "@/domains/external-endpoint/types";

export type UpstreamType = "external" | "endpoint_ref";

export function deriveUpstreamType(
  upstream: Pick<UpstreamSpec, "endpoint_ref"> | undefined,
): UpstreamType {
  return upstream?.endpoint_ref != null ? "endpoint_ref" : "external";
}
