import type { UpstreamSpec } from "@/domains/external-endpoint/types";

/**
 * Clean upstream data before submitting to the API.
 * - Strips mutually exclusive fields (endpoint_ref vs upstream/auth)
 * - In edit mode, removes empty credentials so the backend retains existing values.
 */
export function cleanUpstreamsForSubmit(
  upstreams: UpstreamSpec[],
  isEdit: boolean,
): UpstreamSpec[] {
  return upstreams.map((u) => {
    let result = { ...u };

    // Mutual exclusion: endpoint_ref vs upstream/auth
    if (result.endpoint_ref) {
      const { upstream, auth, ...rest } = result;
      result = rest as UpstreamSpec;
    } else {
      const { endpoint_ref, ...rest } = result;
      result = rest as UpstreamSpec;
    }

    // In edit mode, strip empty credentials so the backend retains existing values
    if (isEdit && result.auth && !result.auth.credential) {
      const { credential, ...authRest } = result.auth;
      result = { ...result, auth: authRest };
    }

    return result;
  });
}
