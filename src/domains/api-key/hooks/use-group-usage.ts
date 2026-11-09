import { useMemo } from "react";
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
};

const groupUsageParams = (
  workspace: string,
  startDate: string,
  endDate: string,
  kind: GroupUsageKind,
  { orgUnit, team, name }: GroupUsageFilter,
) => ({
  p_start_date: startDate,
  p_end_date: endDate,
  p_kind: kind,
  ...(workspace === ALL_WORKSPACES ? {} : { p_workspace: workspace }),
  ...(orgUnit ? { p_org_unit: orgUnit } : {}),
  ...(team ? { p_team: team } : {}),
  ...(name ? { p_name: name } : {}),
});

const URL = "/rpc/get_usage_by_group";

// useGroupUsage polls get_usage_by_group for one kind of group. The RPC needs a
// global workspace:usage-read, or org_unit:usage-read for the caller's subtree;
// pass an empty workspace to skip the call for everyone else. ALL_WORKSPACES
// omits p_workspace, as in useWorkspaceUsage.
export function useGroupUsage(
  workspace: string | undefined,
  startDate: string,
  endDate: string,
  kind: GroupUsageKind,
  filter: GroupUsageFilter = {},
) {
  const { orgUnit, team, name } = filter;
  const paramsList = useMemo(
    () =>
      workspace
        ? [
            groupUsageParams(workspace, startDate, endDate, kind, {
              orgUnit,
              team,
              name,
            }),
          ]
        : null,
    [workspace, startDate, endDate, kind, orgUnit, team, name],
  );
  return useUsageRpcBatch<GroupUsageRecord>(URL, paramsList);
}

// useGroupUsageInUnits is useGroupUsage once per OrgUnit, with the rows of
// every call together. Each call is narrowed to one OrgUnit's subtree, and to
// one group of the kind when `name` is given.
export function useGroupUsageInUnits(
  workspace: string | undefined,
  startDate: string,
  endDate: string,
  kind: GroupUsageKind,
  orgUnits: string[],
  name?: string,
) {
  const unitsKey = orgUnits.join("\u0000");
  const paramsList = useMemo(
    () =>
      workspace
        ? unitsKey
            .split("\u0000")
            .filter(Boolean)
            .map((orgUnit) =>
              groupUsageParams(workspace, startDate, endDate, kind, {
                orgUnit,
                name,
              }),
            )
        : null,
    [workspace, startDate, endDate, kind, unitsKey, name],
  );
  return useUsageRpcBatch<GroupUsageRecord>(URL, paramsList);
}
