import { useMemo } from "react";
import type { GroupUsageKind, GroupUsageRecord } from "@/domains/api-key/types";
import { ALL_WORKSPACES } from "@/foundation/hooks/use-workspace";
import { useUsageRpc } from "./use-usage-by-dimension";

/** Narrows get_usage_by_group; the server never widens what the caller reads. */
export type GroupUsageFilter = {
  /** An OrgUnit's metadata.name: usage recorded under it or its subtree. */
  orgUnit?: string;
  /** A Team's metadata.name. Needs a global workspace:usage-read. */
  team?: string;
};

// useGroupUsage polls get_usage_by_group for one kind of group. The RPC needs a
// global workspace:usage-read; pass an empty workspace to skip the call for
// everyone else. ALL_WORKSPACES omits p_workspace, as in useWorkspaceUsage.
export function useGroupUsage(
  workspace: string | undefined,
  startDate: string,
  endDate: string,
  kind: GroupUsageKind,
  filter: GroupUsageFilter = {},
) {
  const { orgUnit, team } = filter;
  const params = useMemo(
    () =>
      workspace
        ? {
            p_start_date: startDate,
            p_end_date: endDate,
            p_kind: kind,
            ...(workspace === ALL_WORKSPACES ? {} : { p_workspace: workspace }),
            ...(orgUnit ? { p_org_unit: orgUnit } : {}),
            ...(team ? { p_team: team } : {}),
          }
        : null,
    [workspace, startDate, endDate, kind, orgUnit, team],
  );
  return useUsageRpc<GroupUsageRecord>("/rpc/get_usage_by_group", params);
}
