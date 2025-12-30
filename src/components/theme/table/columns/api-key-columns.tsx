import { useTranslation } from "@/lib/i18n";
import { Download, Trash2 } from "lucide-react";
import { Table } from "..";

export const useApiKeyColumns = () => {
  const { t } = useTranslation();

  return {
    email: (
      <Table.Column
        header={t("table.column.email")}
        accessorKey="spec.email"
        id="email"
        enableHiding
      />
    ),
    action: (
      <Table.Column
        accessorKey={"id"}
        id={"actions"}
        cell={({ row: { original } }) => (
          <Table.Actions>
            <Table.ExportYamlAction
              row={original}
              resource="api_keys"
              icon={<Download size={16} />}
            />
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
