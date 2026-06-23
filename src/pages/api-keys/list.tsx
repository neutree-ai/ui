import { useInvalidate, useList, useNavigation } from "@refinedev/core";
import { Pencil, Power, PowerOff, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiKeyRankingOverview } from "@/domains/api-key/components/ApiKeyRankingOverview";
import { CreateApiKeyForm } from "@/domains/api-key/components/CreateApiKeyForm";
import {
  rateSummary,
  useAllApiKeyTraffic,
  useAllApiKeyUsage,
  useApiKeyDisable,
  useWorkspaceModelMap,
} from "@/domains/api-key/hooks/use-api-key-policy";
import type { ApiKey, ApiKeyLimits } from "@/domains/api-key/types";
import { ListPage } from "@/foundation/components/ListPage";
import { useMetadataColumns } from "@/foundation/components/metadata-columns";
import { defaultSorters, RowAction, Table } from "@/foundation/components/Table";
import { ALL_WORKSPACES, useWorkspace } from "@/foundation/hooks/use-workspace";
import { useTranslation } from "@/foundation/lib/i18n";
import { cn } from "@/foundation/lib/utils";

const fmt = (n: number) => Number(n).toLocaleString();

export const ApiKeysList = () => {
  const { t } = useTranslation();
  const { show } = useNavigation();
  const [open, setOpen] = useState(false);
  const metadataColumns = useMetadataColumns();
  const { current: workspace } = useWorkspace();
  const usageByKey = useAllApiKeyUsage(workspace);
  const trafficByKey = useAllApiKeyTraffic(workspace);
  const modelMap = useWorkspaceModelMap(workspace);
  const { disable, enable } = useApiKeyDisable();
  const invalidate = useInvalidate();
  const refresh = useCallback(
    () => invalidate({ resource: "api_keys", invalidates: ["list"] }),
    [invalidate],
  );

  // Keys (id -> name) for the ranking overview. Workspace-scoped via resource
  // meta (matches the table query, no cross-workspace over-fetch) and
  // unpaginated so no key is dropped from the ranking inputs.
  const { data: keysData } = useList<ApiKey>({
    resource: "api_keys",
    pagination: { mode: "off" },
    meta: { workspace },
    queryOptions: { enabled: Boolean(workspace) },
  });
  const rankingKeys = useMemo(() => {
    const rows = keysData?.data ?? [];
    return rows
      .filter(
        (k) =>
          workspace === ALL_WORKSPACES || k.metadata?.workspace === workspace,
      )
      .map((k) => ({ id: String(k.id), name: k.metadata?.name ?? String(k.id) }));
  }, [keysData, workspace]);

  // Limits live on the key itself (spec.limits) — read straight off each row,
  // no separate fetch.
  const limitsOf = (original: ApiKey): ApiKeyLimits =>
    (original.spec?.limits as ApiKeyLimits | undefined) ?? {};

  const dash = <span className="text-muted-foreground">—</span>;

  // Token quota usage: used / limit with a progress bar (amber ≥80%, red over).
  const usageColumn = (
    <Table.Column
      accessorKey="id"
      id="usage"
      header={t("api_keys.limits.usageColumn")}
      cell={({ row: { original } }) => {
        const u = usageByKey.get(String(original.id));
        if (!u || u.token_limit <= 0) return dash;
        const ratio = u.used / u.token_limit;
        const pct = Math.max(0, Math.min(100, ratio * 100));
        const over = u.used >= u.token_limit;
        const warn = !over && ratio >= 0.8;
        return (
          <div className="flex w-40 flex-col gap-1">
            <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
              <span>
                {fmt(u.used)} / {fmt(u.token_limit)}
              </span>
              <span>{Math.round(pct)}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-primary/20">
              <div
                className={cn(
                  "h-full",
                  over ? "bg-destructive" : warn ? "bg-amber-500" : "bg-primary",
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      }}
    />
  );

  // Rate limits (RPS / RPM / concurrency).
  const rateColumn = (
    <Table.Column
      accessorKey="id"
      id="rate_limits"
      header={t("api_keys.limits.rateColumn")}
      cell={({ row: { original } }) => {
        const rate = rateSummary(limitsOf(original as ApiKey));
        return rate.length > 0 ? (
          <span className="text-xs text-muted-foreground">
            {rate.join(" · ")}
          </span>
        ) : (
          dash
        );
      }}
    />
  );

  // Supported (allowed) models — "All" when no allowlist.
  const modelsColumn = (
    <Table.Column
      accessorKey="id"
      id="supported_models"
      header={t("api_keys.limits.modelsColumn")}
      cell={({ row: { original } }) => {
        const models = limitsOf(original as ApiKey).allowed_models ?? [];
        if (models.length === 0) {
          return (
            <span className="text-xs text-muted-foreground">
              {t("api_keys.limits.allModels")}
            </span>
          );
        }
        // Each allowed model on its own line: name (bold, truncated) with its
        // Internal/External tag(s) — from the serving endpoint(s) — stacked
        // below. A model served both ways shows both tags.
        return (
          <div className="flex flex-col gap-2">
            {models.map((m) => {
              const info = modelMap.get(m);
              return (
                <div key={m} className="flex min-w-0 flex-col gap-1">
                  <span className="truncate text-sm font-semibold" title={m}>
                    {m}
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {info?.internal && (
                      <Badge variant="outline" className="font-normal">
                        {t("api_keys.models.internal")}
                      </Badge>
                    )}
                    {info?.external && (
                      <Badge variant="outline" className="font-normal">
                        {t("api_keys.models.external")}
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      }}
    />
  );

  // Status: Disabled (a 'disabled' access rule blocks the key) > Quota exceeded
  // (current-period usage at/over the limit) > Active.
  const statusColumn = (
    <Table.Column
      accessorKey="id"
      id="status"
      header={t("api_keys.limits.statusColumn")}
      cell={({ row: { original } }) => {
        const id = String(original.id);
        if (limitsOf(original as ApiKey).disabled) {
          return (
            <Badge variant="destructive">
              {t("api_keys.limits.statusDisabled")}
            </Badge>
          );
        }
        const u = usageByKey.get(id);
        if (u && u.token_limit > 0 && u.used >= u.token_limit) {
          return (
            <Badge variant="destructive">
              {t("api_keys.limits.statusQuotaExceeded")}
            </Badge>
          );
        }
        return (
          <Badge variant="outline">{t("api_keys.limits.statusActive")}</Badge>
        );
      }}
    />
  );

  const actionColumn = (
    <Table.Column
      accessorKey={"id"}
      id={"actions"}
      cell={({ row: { original } }) => {
        const isDisabled = limitsOf(original as ApiKey).disabled;
        return (
          <Table.Actions>
            <RowAction
              title={t("buttons.edit")}
              icon={<Pencil size={16} />}
              onClick={() => {
                if (original.id) show("api_keys", original.id);
              }}
            />
            <RowAction
              title={
                isDisabled
                  ? t("api_keys.limits.enable")
                  : t("api_keys.limits.disable")
              }
              icon={isDisabled ? <Power size={16} /> : <PowerOff size={16} />}
              onClick={async () => {
                if (isDisabled) await enable(String(original.id));
                else await disable(String(original.id));
                refresh();
              }}
            />
            <Table.DeleteAction
              title={t("buttons.delete")}
              row={original}
              resource="api_keys"
              icon={<Trash2 size={16} />}
            />
          </Table.Actions>
        );
      }}
    />
  );

  return (
    <ListPage
      createButtonProps={{
        onClick: () => {
          setOpen(true);
        },
      }}
    >
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("api_keys.create")}</DialogTitle>
            <DialogDescription>
              {t("api_keys.messages.createDescription")}
            </DialogDescription>
          </DialogHeader>
          <CreateApiKeyForm onClose={() => setOpen(false)} />
        </DialogContent>
      </Dialog>

      <div className="mb-4">
        <ApiKeyRankingOverview keys={rankingKeys} traffic={trafficByKey} />
      </div>

      <Table
        enableSorting
        enableFilters
        enableBatchDelete
        searchField="metadata->>name"
        refineCoreProps={{
          sorters: defaultSorters,
        }}
      >
        {metadataColumns.name}
        {metadataColumns.workspace}
        {statusColumn}
        {usageColumn}
        {rateColumn}
        {modelsColumn}
        {metadataColumns.creation_timestamp}
        {actionColumn}
      </Table>
    </ListPage>
  );
};
