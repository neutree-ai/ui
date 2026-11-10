import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  type OrganizationView,
  readOrganizationView,
  writeOrganizationView,
} from "@/domains/organization/lib/organization-view";

/**
 * The Organization page's view, kept in the URL. `replace` updates the
 * current history entry, for changes too small to go back to (expanding a
 * node).
 */
export const useOrganizationView = () => {
  const [params, setParams] = useSearchParams();
  const view = useMemo(() => readOrganizationView(params), [params]);
  const update = useCallback(
    (change: Partial<OrganizationView>, { replace = false } = {}) =>
      setParams((previous) => writeOrganizationView(previous, change), {
        replace,
      }),
    [setParams],
  );
  return [view, update] as const;
};
