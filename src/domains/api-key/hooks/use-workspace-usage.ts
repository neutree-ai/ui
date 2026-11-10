import { ALL_WORKSPACES } from "@/foundation/hooks/use-workspace";
import { useUsageByDimension } from "./use-usage-by-dimension";

// useWorkspaceUsage returns a whole workspace's per-day, per-API-key, per-model
// token usage (scoped to the caller's visible API keys by the RPC's auth.uid()
// + permission filter). Same RPC as useApiKeyUsage, keyed by workspace + date
// range. `enabled` false keeps the cached rows without fetching. `team` narrows
// to usage recorded under that Team (p_team).
//
// "All workspaces" (ALL_WORKSPACES / "_all_") is a UI-only sentinel, not a real
// workspace name. The RPC treats p_workspace as a narrowing filter
// (`p_workspace IS NULL OR workspace = p_workspace`), so forwarding "_all_"
// verbatim would match no workspace and return an empty page. Instead we omit
// p_workspace entirely, which makes the RPC aggregate across every workspace the
// caller is entitled to — mirroring how the data provider drops the workspace
// filter for ALL_WORKSPACES on standard list queries.
export function useWorkspaceUsage(
  workspace: string | undefined,
  startDate: string,
  endDate: string,
  enabled = true,
  team?: string,
) {
  return useUsageByDimension(
    workspace
      ? {
          p_start_date: startDate,
          p_end_date: endDate,
          ...(workspace === ALL_WORKSPACES ? {} : { p_workspace: workspace }),
          ...(team ? { p_team: team } : {}),
        }
      : null,
    enabled,
  );
}
