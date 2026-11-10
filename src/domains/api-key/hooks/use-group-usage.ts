import type { GroupUsageKind, GroupUsageRecord } from "@/domains/api-key/types";
import { ALL_WORKSPACES } from "@/foundation/hooks/use-workspace";
import { useUsageRpcBatch } from "./use-usage-rpc";

/** Narrows get_usage_by_group; the server never widens what the caller reads. */
export type GroupUsageFilter = {
  /** An OrgUnit's metadata.name: usage recorded under it or its subtree. */
  orgUnit?: string;
  /** A Team's metadata.name. Needs a global workspace:usage-read. */
  team?: string;
  /** One group of the kind: a user id, or a Team's or OrgUnit's name. */
  name?: string;
  /**
   * With orgUnit, usage recorded under that OrgUnit itself, not its subtree;
   * without, usage recorded under no OrgUnit (global readers only).
   */
  direct?: boolean;
};

const groupUsageParams = (
  workspace: string,
  startDate: string,
  endDate: string,
  kind: GroupUsageKind,
  { orgUnit, team, name, direct }: GroupUsageFilter,
) => ({
  p_start_date: startDate,
  p_end_date: endDate,
  p_kind: kind,
  ...(workspace === ALL_WORKSPACES ? {} : { p_workspace: workspace }),
  ...(orgUnit ? { p_org_unit: orgUnit } : {}),
  ...(team ? { p_team: team } : {}),
  ...(name ? { p_name: name } : {}),
  ...(direct ? { p_direct: true } : {}),
});

// useGroupUsage polls get_usage_by_group for one kind of group, once per
// filter, with the rows of every call together. The RPC needs a global
// workspace:usage-read, or org_unit:usage-read for the caller's subtree; pass
// an empty workspace or `enabled` false to skip the call for everyone else.
// ALL_WORKSPACES omits p_workspace, as in useWorkspaceUsage.
export function useGroupUsage(
  workspace: string | undefined,
  startDate: string,
  endDate: string,
  kind: GroupUsageKind,
  filters: GroupUsageFilter[],
  enabled = true,
) {
  return useUsageRpcBatch<GroupUsageRecord>(
    "/rpc/get_usage_by_group",
    workspace
      ? filters.map((filter) =>
          groupUsageParams(workspace, startDate, endDate, kind, filter),
        )
      : [],
    enabled && !!workspace,
  );
}
