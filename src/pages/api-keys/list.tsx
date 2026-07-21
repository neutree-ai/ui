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
import type {
  AllowedModel,
  ApiKey,
  ApiKeyLimits,
} from "@/domains/api-key/types";
import { ListPage } from "@/foundation/components/ListPage";
import { useMetadataColumns } from "@/foundation/components/metadata-columns";
import {
  defaultSorters,
  RowAction,
  Table,
} from "@/foundation/components/Table";
import { ALL_WORKSPACES, useWorkspace } from "@/foundation/hooks/use-workspace";
import { useTranslation } from "@/foundation/lib/i18n";
import { formatTokenQuota } from "@/foundation/lib/token-quota";
import { cn } from "@/foundation/lib/utils";

const endpointPhaseClass = (phase: string | null | undefined) =>
  ({
    Running: "border-green-200 bg-green-50 text-green-700",
    Failed: "border-red-200 bg-red-50 text-red-700",
    Pending: "border-yellow-200 bg-yellow-50 text-yellow-700",
    Deploying: "border-blue-200 bg-blue-50 text-blue-700",
    ModelDownloading: "border-cyan-200 bg-cyan-50 text-cyan-700",
    Deleting: "border-orange-200 bg-orange-50 text-orange-700",
    Paused: "border-yellow-200 bg-yellow-50 text-yellow-700",
    Deleted: "border-gray-200 bg-gray-50 text-gray-700",
  })[phase ?? ""] ?? "border-muted bg-muted text-muted-foreground";

// Number of allowed models rendered before the cell collapses the rest behind
// a "show N more" toggle — keeps rows short when a key allows many models.
const MODELS_COLLAPSED = 2;

// Allowed-models table cell: renders each model (name + endpoint/type/phase) on
// its own block, but only the first MODELS_COLLAPSED until expanded in place.
function ModelsCell({
  models,
  modelMap,
  scopedWorkspace,
}: {
  models: AllowedModel[];
  modelMap: ReturnType<typeof useWorkspaceModelMap>;
  scopedWorkspace: string | undefined;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? models : models.slice(0, MODELS_COLLAPSED);
  const hiddenCount = models.length - MODELS_COLLAPSED;

  return (
    <div className="flex flex-col gap-2">
      {visible.map((m, i) => {
        // A pinned entry shows only its one endpoint; a wildcard entry (migrated
        // legacy, no type/endpoint_name) allows any endpoint serving the model.
        const pinned = !!m.type && !!m.endpoint_name;
        const servingEndpoint = pinned
          ? modelMap
              .get(m.model)
              ?.endpoints.find(
                (e) => e.name === m.endpoint_name && e.type === m.type,
              )
          : undefined;
        return (
          <div
            key={`${m.type ?? ""}:${m.endpoint_name ?? ""}:${m.model}:${i}`}
            className="flex min-w-0 flex-col gap-1"
          >
            <span className="truncate text-sm font-semibold" title={m.model}>
              {m.model}
            </span>
            {pinned ? (
              <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <span className="truncate max-w-[140px]">
                  {m.endpoint_name}
                </span>
                <Badge variant="outline" className="h-5 font-normal">
                  {t(`api_keys.models.${m.type}`)}
                </Badge>
                {servingEndpoint ? (
                  <Badge
                    variant="outline"
                    className={cn(
                      "h-5 font-normal",
                      endpointPhaseClass(servingEndpoint.phase),
                    )}
                  >
                    {servingEndpoint.phase
                      ? t(`status.phases.endpoint.${servingEndpoint.phase}`)
                      : t("api_keys.models.unknown")}
                  </Badge>
                ) : scopedWorkspace ? (
                  <Badge variant="outline" className="h-5 font-normal">
                    {t("api_keys.modelAccess.unavailable")}
                  </Badge>
                ) : null}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">
                {t("api_keys.models.anySource")}
              </span>
            )}
          </div>
        );
      })}
      {models.length > MODELS_COLLAPSED && (
        <button
          type="button"
          onClick={(e) => {
            // Don't trigger row navigation when toggling the cell.
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          className="self-start text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {expanded
            ? t("api_keys.limits.showLess")
            : t("api_keys.limits.showMore", { count: hiddenCount })}
        </button>
      )}
    </div>
  );
}

export const ApiKeysList = () => {
  const { t } = useTranslation();
  const { show } = useNavigation();
  const [open, setOpen] = useState(false);
  const metadataColumns = useMetadataColumns();
  const { current: workspace } = useWorkspace();
  // These aggregates are per-workspace RPCs; ALL_WORKSPACES (`_all_`) is a
  // UI-only sentinel, not a real workspace, so gate them to a concrete value
  // (the hooks no-op on undefined) instead of firing p_workspace="_all_".
  const scopedWorkspace = workspace === ALL_WORKSPACES ? undefined : workspace;
  const usageByKey = useAllApiKeyUsage(scopedWorkspace);
  const trafficByKey = useAllApiKeyTraffic(scopedWorkspace);
  const modelMap = useWorkspaceModelMap(scopedWorkspace);
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
    // workspaced: true is what the data provider checks to apply the
    // metadata->workspace filter (resource meta isn't merged here).
    meta: { workspace, workspaced: true },
    queryOptions: { enabled: Boolean(workspace) },
  });
  const rankingKeys = useMemo(() => {
    const rows = keysData?.data ?? [];
    return rows
      .filter(
        (k) =>
          workspace === ALL_WORKSPACES || k.metadata?.workspace === workspace,
      )
      .map((k) => ({
        id: String(k.id),
        name: k.metadata?.name ?? String(k.id),
      }));
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
                {formatTokenQuota(u.used)} / {formatTokenQuota(u.token_limit)}
              </span>
              <span>{Math.round(pct)}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-primary/20">
              <div
                className={cn(
                  "h-full",
                  over
                    ? "bg-destructive"
                    : warn
                      ? "bg-amber-500"
                      : "bg-primary",
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
        return (
          <ModelsCell
            models={models}
            modelMap={modelMap}
            scopedWorkspace={scopedWorkspace}
          />
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
                const k = original as ApiKey;
                // The api_keys show route is keyed by metadata.name (not the raw
                // key id), and in the ALL_WORKSPACES view the row's own
                // workspace must fill the :workspace route param.
                if (k.metadata?.name) {
                  show("api_keys", k.metadata.name, "push", {
                    workspace: k.metadata.workspace,
                  });
                }
              }}
            />
            <RowAction
              title={
                isDisabled
                  ? t("api_keys.limits.enable")
                  : t("api_keys.limits.disable")
              }
              icon={isDisabled ? <Power size={16} /> : <PowerOff size={16} />}
              onClick={() => {
                const id = String(original.id);
                void (isDisabled ? enable(id) : disable(id))
                  .then(() => refresh())
                  .catch(() => {});
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
        <DialogContent className="sm:max-w-2xl">
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
