import type {
  ExternalEndpointSpec,
  UpstreamSpec,
  UpstreamStatus,
} from "@/domains/external-endpoint/types";

/**
 * Mirror of the API's upstream-URL sanitiser: it publishes the reference with
 * the userinfo, query and fragment removed, because providers carry API keys
 * in all three. Comparing raw spec URLs against it would never match for those
 * upstreams. Kept as a textual strip rather than a `URL` round-trip, which
 * would normalise (e.g. append a trailing slash) where the API does not.
 */
function sanitizeUpstreamUrl(url: string): string {
  return url
    .split("#")[0]
    .split("?")[0]
    .replace(/^([a-z][a-z\d+.-]*:\/\/)[^/@]*@/i, "$1");
}

function upstreamRefs(upstream: UpstreamSpec): string[] {
  if (upstream.endpoint_ref) return [upstream.endpoint_ref];

  const url = upstream.upstream?.url;
  if (!url) return [];

  return [url, sanitizeUpstreamUrl(url)];
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
    if (!status?.ref) return null;

    return upstreamRefs(upstream).includes(status.ref) ? status : null;
  });
}
