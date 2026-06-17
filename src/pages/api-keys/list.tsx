import { useNavigation } from "@refinedev/core";
import { Pencil, Power, PowerOff, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CreateApiKeyForm } from "@/domains/api-key/components/CreateApiKeyForm";
import {
  useAllApiKeyLimits,
  useAllApiKeyUsage,
  useApiKeyDisable,
} from "@/domains/api-key/hooks/use-api-key-policy";
import { ListPage } from "@/foundation/components/ListPage";
import { useMetadataColumns } from "@/foundation/components/metadata-columns";
import { defaultSorters, RowAction, Table } from "@/foundation/components/Table";
import { useWorkspace } from "@/foundation/hooks/use-workspace";
import { useTranslation } from "@/foundation/lib/i18n";
import { cn } from "@/foundation/lib/utils";

const fmt = (n: number) => Number(n).toLocaleString();

export const ApiKeysList = () => {
  const { t } = useTranslation();
  const { show } = useNavigation();
  const [open, setOpen] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const metadataColumns = useMetadataColumns();
  const { current: workspace } = useWorkspace();
  const limitsByKey = useAllApiKeyLimits(refreshToken);
  const usageByKey = useAllApiKeyUsage(workspace);
  const { disable, enable } = useApiKeyDisable();
  const refresh = useCallback(() => setRefreshToken((n) => n + 1), []);

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
        const rate = limitsByKey.get(String(original.id))?.rate ?? [];
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
        const models = limitsByKey.get(String(original.id))?.models ?? [];
        return models.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {models.map((m) => (
              <Badge key={m} variant="secondary" className="font-normal">
                {m}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">
            {t("api_keys.limits.allModels")}
          </span>
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
        if (limitsByKey.get(id)?.disabled) {
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
        const isDisabled = limitsByKey.get(String(original.id))?.disabled;
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
