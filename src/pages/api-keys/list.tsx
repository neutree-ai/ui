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
import { useAllApiKeyLimits } from "@/domains/api-key/hooks/use-api-key-policy";
import { ListPage } from "@/foundation/components/ListPage";
import { useMetadataColumns } from "@/foundation/components/metadata-columns";
import { defaultSorters, Table } from "@/foundation/components/Table";
import { useTranslation } from "@/foundation/lib/i18n";

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
  const limitsByKey = useAllApiKeyLimits();

  const limitsColumn = (
    <Table.Column
      accessorKey="id"
      id="limits"
      header={t("api_keys.limits.columnTitle")}
      cell={({ row: { original } }) => {
        const parts = limitsByKey.get(String(original.id)) ?? [];
        return parts.length > 0 ? (
          <span className="text-xs text-muted-foreground">
            {parts.join(" · ")}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
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
        {limitsColumn}
        {metadataColumns.update_timestamp}
        {metadataColumns.creation_timestamp}
        {apiKeyColumns.action}
      </Table>
    </ListPage>
  );
};
