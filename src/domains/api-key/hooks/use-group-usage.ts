import { useMemo } from "react";
import type { GroupUsageKind, GroupUsageRecord } from "@/domains/api-key/types";
import { ALL_WORKSPACES } from "@/foundation/hooks/use-workspace";
import { useUsageRpc } from "./use-usage-by-dimension";

// useGroupUsage polls get_usage_by_group for one kind of group. The RPC needs a
// global workspace:usage-read; pass an empty workspace to skip the call for
// everyone else. ALL_WORKSPACES omits p_workspace, as in useWorkspaceUsage.
export function useGroupUsage(
  workspace: string | undefined,
  startDate: string,
  endDate: string,
  kind: GroupUsageKind,
) {
  const params = useMemo(
    () =>
      workspace
        ? {
            p_start_date: startDate,
            p_end_date: endDate,
            p_kind: kind,
            ...(workspace === ALL_WORKSPACES ? {} : { p_workspace: workspace }),
          }
        : null,
    [workspace, startDate, endDate, kind],
  );
  return useUsageRpc<GroupUsageRecord>("/rpc/get_usage_by_group", params);
}
