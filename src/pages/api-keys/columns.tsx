import { Table } from "@/foundation/components/Table";
import { useTranslate } from "@refinedev/core";
import { Trash2 } from "lucide-react";

export const useApiKeyColumns = () => {
  const t = useTranslate();

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
