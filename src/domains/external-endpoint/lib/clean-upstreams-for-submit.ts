import type { UpstreamSpec } from "@/domains/external-endpoint/types";
import { type DirtyFields, isDirtyField } from "@/foundation/lib/dirty-fields";

/**
 * Clean upstream data before submitting to the API.
 * - Strips mutually exclusive fields (endpoint_ref vs upstream/auth)
 * - In edit mode, removes unchanged empty credentials so the backend retains existing values.
 */
export function cleanUpstreamsForSubmit(
  upstreams: UpstreamSpec[],
  isEdit: boolean,
  dirtyFields?: DirtyFields,
): UpstreamSpec[] {
  return upstreams.map((u, index) => {
    let result = { ...u };
    // Mutual exclusion: endpoint_ref vs upstream/auth
    if (result.endpoint_ref) {
      const { upstream, auth, ...rest } = result;
      result = rest as UpstreamSpec;
    } else {
      const { endpoint_ref, ...rest } = result;
      result = rest as UpstreamSpec;
    }
    // In edit mode, strip unchanged empty credentials so the backend retains existing values.
    if (
      isEdit &&
      result.auth &&
      !result.auth.credential &&
      !isDirtyField(dirtyFields, [String(index), "auth", "credential"])
    ) {
      const { credential, ...authRest } = result.auth;
      result = { ...result, auth: authRest };
    }
    return result;
  });
}
