import type { UpstreamSpec } from "@/domains/external-endpoint/types";
import {
  omitEmptyUntouched,
  type TouchedFields,
} from "@/foundation/role/touched-fields";

/**
 * Strips the fields of the unused upstream kind (endpoint_ref vs upstream/auth).
 * On edit an empty untouched credential is dropped so the server keeps the stored one.
 */
export function cleanUpstreamsForSubmit(
  upstreams: UpstreamSpec[],
  isEdit: boolean,
  touchedFields?: TouchedFields,
): UpstreamSpec[] {
  return upstreams.map((u, index) => {
    const result = { ...u };
    if (result.endpoint_ref) {
      delete result.upstream;
      delete result.auth;
      return result;
    }
    delete result.endpoint_ref;
    if (isEdit && result.auth) {
      result.auth = { ...result.auth };
      omitEmptyUntouched(
        result.auth,
        [String(index), "auth"],
        ["credential"],
        touchedFields,
      );
    }
    return result;
  });
}
