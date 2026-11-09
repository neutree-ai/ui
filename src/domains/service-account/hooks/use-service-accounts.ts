import { useCustom, useList } from "@refinedev/core";
import { ServiceAccountGoneError } from "@/domains/service-account/lib/errors";
import type {
  ServiceAccount,
  TeamApplicationPermissions,
} from "@/domains/service-account/types";
import { useRowWrite } from "@/foundation/hooks/use-row-write";

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
  const { run: write, isPending } = useRowWrite({
    invalidates: ["service_accounts"],
    onNoRow: () => new ServiceAccountGoneError(),
  });
  const run = async (
    url: string,
    method: "post" | "patch" | "delete",
    values?: unknown,
  ) => ((await write(url, method, values)) as ServiceAccount[] | null)?.[0];
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
    isPending,
  };
};

/** The application permissions in force for a Team: its own, or the default. */
export const useTeamApplicationPermissions = (teamId: number | undefined) => {
  const query = useCustom<TeamApplicationPermissions[]>({
    url: "/rpc/get_team_application_permissions",
    method: "post",
    config: { payload: { p_team_id: teamId } },
    queryOptions: {
      enabled: teamId !== undefined,
      retry: false,
      queryKey: ["team-application-permissions", teamId],
    },
    successNotification: false,
    errorNotification: false,
  });
  const rows = query.data?.data as TeamApplicationPermissions[] | undefined;
  return {
    appPermissions: rows?.[0],
    isLoading: teamId !== undefined && query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
};

/** Set a Team's application permissions, or put them back on the default. */
export const useTeamApplicationPermissionsWrites = (teamId: number) => {
  // The card refetches the RPC after a write. Resetting permissions someone
  // else already reset ends on the default, so no row is fine.
  const { run: call, isPending } = useRowWrite({ invalidates: [] });
  const byTeam = `/team_application_permissions?team_id=eq.${teamId}`;

  return {
    save: (
      current: TeamApplicationPermissions,
      next: { roles: string[]; workspaces: string[] | null },
    ) =>
      current.is_default
        ? call("/team_application_permissions", "post", {
            team_id: teamId,
            ...next,
          })
        : call(byTeam, "patch", next),
    reset: () => call(byTeam, "delete"),
    isPending,
  };
};
