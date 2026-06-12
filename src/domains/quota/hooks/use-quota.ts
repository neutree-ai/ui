import { useCustomMutation, useList } from "@refinedev/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  QuotaApiKeyLite,
  QuotaLevel,
  QuotaPeriod,
  QuotaPolicy,
  QuotaPolicyRow,
  QuotaUserLite,
} from "@/domains/quota/types";
import { ALL_WORKSPACES } from "@/foundation/hooks/use-workspace";

// Params accepted by /rpc/set_quota_policy (snake_case p_* mirror the SQL
// function signature). Only the fields relevant to the chosen level are sent.
export type SetQuotaParams = {
  p_level: QuotaLevel;
  p_period: QuotaPeriod;
  p_limit_tokens: number;
  p_workspace?: string;
  p_user_id?: string;
  p_api_key_id?: string;
};

// useQuota lists the quota policies visible to the caller in one workspace and
// enriches each with its current-period usage and a human-readable target name.
// It also exposes set/delete mutations against the management-plane RPCs.
export function useQuota(workspace: string | undefined) {
  const [rows, setRows] = useState<QuotaPolicyRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { mutateAsync } = useCustomMutation();

  // Lookups to resolve user_id / api_key_id -> display name.
  const { data: usersData } = useList<QuotaUserLite>({
    resource: "user_profiles",
    pagination: { mode: "off" },
  });
  const { data: keysData } = useList<QuotaApiKeyLite>({
    resource: "api_keys",
    pagination: { mode: "off" },
    meta: { workspace },
    queryOptions: { enabled: !!workspace },
  });

  const userById = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of usersData?.data ?? []) {
      m.set(u.id, u.spec?.email || u.metadata?.name || u.id);
    }
    return m;
  }, [usersData]);

  const keyById = useMemo(() => {
    const m = new Map<string, string>();
    for (const k of keysData?.data ?? []) {
      m.set(k.id, k.metadata?.name || k.id);
    }
    return m;
  }, [keysData]);

  const resolveTargetName = useCallback(
    (p: QuotaPolicy): string => {
      if (p.level === "workspace") return p.workspace;
      if (p.level === "user") return userById.get(p.user_id ?? "") ?? p.user_id ?? "-";
      return keyById.get(p.api_key_id ?? "") ?? p.api_key_id ?? "-";
    },
    [userById, keyById],
  );

  const fetch = useCallback(async () => {
    if (!workspace) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await mutateAsync({
        url: "/rpc/get_quota_policies",
        method: "post",
        // "All workspaces" is a UI-only sentinel — omit the filter so the RPC
        // returns every policy the caller may see (RLS-scoped), mirroring how
        // workspace usage drops the filter for ALL_WORKSPACES.
        values: workspace === ALL_WORKSPACES ? {} : { p_workspace: workspace },
      });
      const policies = (res.data as QuotaPolicy[]) ?? [];

      const enriched = await Promise.all(
        policies.map(async (p): Promise<QuotaPolicyRow> => {
          let usage = 0;
          try {
            const u = await mutateAsync({
              url: "/rpc/get_quota_scope_usage",
              method: "post",
              values: {
                p_level: p.level,
                p_period: p.period,
                p_workspace: p.workspace,
                p_user_id: p.user_id ?? undefined,
                p_api_key_id: p.api_key_id ?? undefined,
              },
            });
            usage = Number(u.data ?? 0) || 0;
          } catch {
            usage = 0;
          }
          return {
            ...p,
            usage,
            remaining: Number(p.limit_tokens) - usage,
            targetName: resolveTargetName(p),
          };
        }),
      );
      setRows(enriched);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [workspace, mutateAsync, resolveTargetName]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const setQuota = useCallback(
    async (params: SetQuotaParams) => {
      await mutateAsync({
        url: "/rpc/set_quota_policy",
        method: "post",
        values: params,
      });
      await fetch();
    },
    [mutateAsync, fetch],
  );

  const deleteQuota = useCallback(
    async (id: number) => {
      await mutateAsync({
        url: "/rpc/delete_quota_policy",
        method: "post",
        values: { p_id: id },
      });
      await fetch();
    },
    [mutateAsync, fetch],
  );

  return { rows, isLoading, error, refetch: fetch, setQuota, deleteQuota };
}
