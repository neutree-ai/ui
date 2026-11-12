import { ALL_WORKSPACES } from "@/foundation/hooks/use-workspace";
import { useUsageByDimension } from "./use-usage-by-dimension";

// useWorkspaceUsage returns a whole workspace's per-day, per-API-key, per-model
// token usage (scoped to the caller's visible API keys by the RPC's auth.uid()
// + permission filter). Same RPC as useApiKeyUsage, keyed by workspace + date
// range. `enabled` false fetches nothing and yields no rows. `filter` narrows
// to usage recorded under a Team (p_team) or a department (p_org_unit: with
// its sub-departments, or alone with `direct`), and to the keys of one user
// or application. Filters only narrow what the caller reads.
//
// "All workspaces" (ALL_WORKSPACES / "_all_") is a UI-only sentinel, not a real
// workspace name. The RPC treats p_workspace as a narrowing filter
// (`p_workspace IS NULL OR workspace = p_workspace`), so forwarding "_all_"
// verbatim would match no workspace and return an empty page. Instead we omit
// p_workspace entirely, which makes the RPC aggregate across every workspace the
// caller is entitled to — mirroring how the data provider drops the workspace
// filter for ALL_WORKSPACES on standard list queries.
export type KeyUsageFilter = {
  team?: string;
  orgUnit?: string;
  direct?: boolean;
  /** The keys of one user, by id. */
  user?: string;
  /** The keys of one application (ServiceAccount), by id. */
  serviceAccount?: string;
};

export function useWorkspaceUsage(
  workspace: string | undefined,
  startDate: string,
  endDate: string,
  enabled = true,
  { team, orgUnit, direct, user, serviceAccount }: KeyUsageFilter = {},
) {
  return useUsageByDimension(
    workspace
      ? {
          p_start_date: startDate,
          p_end_date: endDate,
          ...(workspace === ALL_WORKSPACES ? {} : { p_workspace: workspace }),
          ...(team ? { p_team: team } : {}),
          ...(orgUnit ? { p_org_unit: orgUnit } : {}),
          ...(orgUnit && direct ? { p_direct: true } : {}),
          ...(user ? { p_user_id: user } : {}),
          ...(serviceAccount ? { p_service_account_id: serviceAccount } : {}),
        }
      : null,
    enabled,
  );
}
