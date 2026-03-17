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
        {metadataColumns.update_timestamp}
        {metadataColumns.creation_timestamp}
        {apiKeyColumns.action}
      </Table>
    </ListPage>
  );
};
