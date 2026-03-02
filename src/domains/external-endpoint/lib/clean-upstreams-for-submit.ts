import type { UpstreamSpec } from "@/domains/external-endpoint/types";

/**
 * Clean upstream data before submitting to the API.
 * In edit mode, removes empty credentials so the backend retains existing values.
 */
export function cleanUpstreamsForSubmit(
  upstreams: UpstreamSpec[],
  isEdit: boolean,
): UpstreamSpec[] {
  return upstreams.map((upstream) => {
    if (!isEdit || !upstream.auth || upstream.auth.credential) {
      return upstream;
    }
    const { credential, ...authRest } = upstream.auth;
    return { ...upstream, auth: authRest };
  });
}
