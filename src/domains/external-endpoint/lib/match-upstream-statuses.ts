import type {
  ExternalEndpointSpec,
  UpstreamSpec,
  UpstreamStatus,
} from "@/domains/external-endpoint/types";

function getUpstreamRef(upstream: UpstreamSpec): string | null {
  return upstream.endpoint_ref ?? upstream.upstream?.url ?? null;
}

/**
 * Pair every spec upstream with the status reported for it.
 *
 * The API emits one status entry per upstream in spec order, so the pairing is
 * positional; the `ref` guard drops a status read back before the next
 * reconcile, where it still describes the previous spec and would otherwise be
 * attributed to the wrong upstream.
 */
export function matchUpstreamStatuses(
  spec: ExternalEndpointSpec | null,
  statuses: UpstreamStatus[] | null | undefined,
): (UpstreamStatus | null)[] {
  return (spec?.upstreams ?? []).map((upstream, index) => {
    const status = statuses?.[index];
    const ref = getUpstreamRef(upstream);

    return status && ref && status.ref === ref ? status : null;
  });
}
