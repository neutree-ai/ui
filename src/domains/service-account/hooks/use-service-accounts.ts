import {
  useCustom,
  useCustomMutation,
  useInvalidate,
  useList,
} from "@refinedev/core";
import type {
  ServiceAccount,
  ServiceAccountCeiling,
} from "@/domains/service-account/types";

const RETURN_ROWS = { headers: { Prefer: "return=representation" } };

/** The applications of one Team the caller may read. */
export const useServiceAccounts = (teamId: number | undefined) => {
  const query = useList<ServiceAccount>({
    resource: "service_accounts",
    pagination: { mode: "off" },
    filters: [{ field: "team_id", operator: "eq", value: teamId }],
    sorters: [{ field: "metadata->name", order: "asc" }],
    queryOptions: { enabled: teamId !== undefined },
  });
  return {
    rows: query.data?.data ?? [],
    isLoading: teamId !== undefined && query.isLoading,
    error: query.error,
  };
};

/** Every application the caller may read, e.g. for a subject picker. */
export const useAllServiceAccounts = (enabled = true) =>
  useList<ServiceAccount>({
    resource: "service_accounts",
    pagination: { mode: "off" },
    sorters: [{ field: "metadata->name", order: "asc" }],
    queryOptions: { enabled },
  });

/** Create, enable / disable and delete the applications of a Team. */
export const useServiceAccountWrites = () => {
  const { mutateAsync, isLoading } = useCustomMutation();
  const invalidate = useInvalidate();

  const run = async (
    url: string,
    method: "post" | "patch" | "delete",
    values?: unknown,
  ) => {
    const { data } = await mutateAsync({
      url,
      method,
      values: values as Record<string, unknown>,
      meta: RETURN_ROWS,
      successNotification: false,
      errorNotification: false,
    });
    await invalidate({ resource: "service_accounts", invalidates: ["list"] });
    return (data as ServiceAccount[] | null)?.[0];
  };
  const byId = (id: string) =>
    `/service_accounts?id=eq.${encodeURIComponent(id)}`;

  return {
    create: (
      teamId: number,
      values: { name: string; displayName: string; description: string },
    ) =>
      run("/service_accounts", "post", {
        api_version: "v1",
        kind: "ServiceAccount",
        metadata: { name: values.name, display_name: values.displayName },
        spec: { description: values.description, disabled: false },
        team_id: teamId,
      }),
    // A composite PATCH nulls the fields it leaves out, so spec goes whole.
    setDisabled: (account: ServiceAccount, disabled: boolean) =>
      run(byId(account.id), "patch", {
        spec: { description: account.spec?.description ?? "", disabled },
      }),
    // No controller: the row goes at once. The server refuses while keys remain.
    remove: (account: ServiceAccount) => run(byId(account.id), "delete"),
    isPending: isLoading,
  };
};

/** The application permissions in force for a Team: its own, or the default. */
export const useServiceAccountCeiling = (teamId: number | undefined) => {
  const query = useCustom<ServiceAccountCeiling[]>({
    url: "/rpc/get_team_service_account_ceiling",
    method: "post",
    config: { payload: { p_team_id: teamId } },
    queryOptions: {
      enabled: teamId !== undefined,
      retry: false,
      queryKey: ["team-service-account-ceiling", teamId],
    },
    successNotification: false,
    errorNotification: false,
  });
  const rows = query.data?.data as ServiceAccountCeiling[] | undefined;
  return {
    ceiling: rows?.[0],
    isLoading: teamId !== undefined && query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
};

/** Set a Team's application permissions, or put them back on the default. */
export const useServiceAccountCeilingWrites = (teamId: number) => {
  const { mutateAsync, isLoading } = useCustomMutation();
  const byTeam = `/team_service_account_ceilings?team_id=eq.${teamId}`;
  const call = (
    url: string,
    method: "post" | "patch" | "delete",
    values?: unknown,
  ) =>
    mutateAsync({
      url,
      method,
      values: values as Record<string, unknown>,
      meta: RETURN_ROWS,
      successNotification: false,
      errorNotification: false,
    });

  return {
    save: (
      current: ServiceAccountCeiling,
      next: { roles: string[]; workspaces: string[] | null },
    ) =>
      current.is_default
        ? call("/team_service_account_ceilings", "post", {
            team_id: teamId,
            ...next,
          })
        : call(byTeam, "patch", next),
    reset: () => call(byTeam, "delete"),
    isPending: isLoading,
  };
};
