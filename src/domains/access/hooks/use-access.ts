import { useCustomMutation, useList } from "@refinedev/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  AccessApiKeyLite,
  AccessLevel,
  AccessPolicy,
  AccessPolicyRow,
  AccessRuleSpec,
  AccessRuleType,
  AccessUserLite,
} from "@/domains/access/types";
import { ALL_WORKSPACES } from "@/foundation/hooks/use-workspace";

// Params accepted by /rpc/set_access_policy (snake_case p_* mirror the SQL
// function signature). Only the fields relevant to the chosen level are sent.
export type SetAccessParams = {
  p_level: AccessLevel;
  p_rule_type: AccessRuleType;
  p_rule_spec: AccessRuleSpec;
  p_workspace?: string;
  p_user_id?: string;
  p_api_key_id?: string;
};

// useAccess lists the access policies visible to the caller in one workspace and
// enriches each with a human-readable target name, plus set/delete mutations.
// Unlike quota there is no usage/remaining (access rules are not cumulative).
export function useAccess(workspace: string | undefined) {
  const [rows, setRows] = useState<AccessPolicyRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { mutateAsync } = useCustomMutation();

  const { data: usersData } = useList<AccessUserLite>({
    resource: "user_profiles",
    pagination: { mode: "off" },
  });
  const { data: keysData } = useList<AccessApiKeyLite>({
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
    (p: AccessPolicy): string => {
      if (p.level === "workspace") return p.workspace;
      if (p.level === "user")
        return userById.get(p.user_id ?? "") ?? p.user_id ?? "-";
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
        url: "/rpc/get_access_policies",
        method: "post",
        values: workspace === ALL_WORKSPACES ? {} : { p_workspace: workspace },
      });
      const policies = (res.data as AccessPolicy[]) ?? [];
      setRows(
        policies.map((p) => ({ ...p, targetName: resolveTargetName(p) })),
      );
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [workspace, mutateAsync, resolveTargetName]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const setAccess = useCallback(
    async (params: SetAccessParams) => {
      await mutateAsync({
        url: "/rpc/set_access_policy",
        method: "post",
        values: params,
      });
      await fetch();
    },
    [mutateAsync, fetch],
  );

  const deleteAccess = useCallback(
    async (id: number) => {
      await mutateAsync({
        url: "/rpc/delete_access_policy",
        method: "post",
        values: { p_id: id },
      });
      await fetch();
    },
    [mutateAsync, fetch],
  );

  return { rows, isLoading, error, refetch: fetch, setAccess, deleteAccess };
}
