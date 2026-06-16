import { Trash2 } from "lucide-react";
import { useState } from "react";
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
} from "@/domains/api-key/hooks/use-api-key-policy";
import { ListPage } from "@/foundation/components/ListPage";
import { useMetadataColumns } from "@/foundation/components/metadata-columns";
import { defaultSorters, Table } from "@/foundation/components/Table";
import { useWorkspace } from "@/foundation/hooks/use-workspace";
import { useTranslation } from "@/foundation/lib/i18n";

const fmt = (n: number) => Number(n).toLocaleString();

const useApiKeyColumns = () => {
  const { t } = useTranslation();

  return {
    action: (
      <Table.Column
        accessorKey={"id"}
        id={"actions"}
        cell={({ row: { original } }) => (
          <Table.Actions>
            <Table.DeleteAction
              title={t("buttons.delete")}
              row={original}
              resource="api_keys"
              icon={<Trash2 size={16} />}
            />
          </Table.Actions>
        )}
      />
    ),
  };
};

export const ApiKeysList = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const metadataColumns = useMetadataColumns();
  const apiKeyColumns = useApiKeyColumns();
  const { current: workspace } = useWorkspace();
  const limitsByKey = useAllApiKeyLimits();
  const usageByKey = useAllApiKeyUsage(workspace);

  const dash = <span className="text-muted-foreground">—</span>;

  // Token quota usage: used / limit (remaining).
  const usageColumn = (
    <Table.Column
      accessorKey="id"
      id="usage"
      header={t("api_keys.limits.usageColumn")}
      cell={({ row: { original } }) => {
        const u = usageByKey.get(String(original.id));
        if (!u) return dash;
        const remaining = Math.max(0, u.token_limit - u.used);
        return (
          <span className="text-xs text-muted-foreground">
            {fmt(u.used)} / {fmt(u.token_limit)} ({t("api_keys.limits.remainingLabel")}{" "}
            {fmt(remaining)})
          </span>
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
          <span className="text-xs text-muted-foreground">{rate.join(" · ")}</span>
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
        return (
          <span className="text-xs text-muted-foreground">
            {models.length > 0 ? models.join(", ") : t("api_keys.limits.allModels")}
          </span>
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
        {usageColumn}
        {rateColumn}
        {modelsColumn}
        {metadataColumns.creation_timestamp}
        {apiKeyColumns.action}
      </Table>
    </ListPage>
  );
};
