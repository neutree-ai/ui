import { Trash2 } from "lucide-react";
import { useTranslate } from "@refinedev/core";
import { Table } from "..";

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
