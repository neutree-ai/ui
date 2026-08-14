import { Edit, Lock, Trash2 } from "lucide-react";
import { ListPage } from "@/foundation/components/ListPage";
import { useMetadataColumns } from "@/foundation/components/metadata-columns";
import { ShowButton } from "@/foundation/components/ShowButton";
import { defaultSorters, Table } from "@/foundation/components/Table";
import { useTranslation } from "@/foundation/lib/i18n";

const useRoleColumns = () => {
  const { t } = useTranslation();
  return {
    name: (
      <Table.Column
        header={t("common.fields.name")}
        accessorKey="metadata.name"
        id="name"
        enableHiding
        cell={({ row }) => {
          const { name } = row.original.metadata;
          const isPreset = Boolean(row.original.spec.preset_key);
          return (
            <div className="flex items-center">
              {isPreset && <Lock size={16} className="mr-1" />}
              <ShowButton
                recordItemId={row.original.metadata.name}
                meta={{}}
                variant="link"
              >
                {name}
              </ShowButton>
            </div>
          );
        }}
      />
    ),
    permissions: (
      <Table.Column
        header={t("common.fields.permissions")}
        accessorKey="spec.permissions"
        id="permissions"
        enableHiding
        cell={({ getValue }) => {
          const value = getValue() as unknown as string[];
          return t("common.fields.permissionsCount", { count: value.length });
        }}
      />
    ),
    action: (
      <Table.Column
        accessorKey={"id"}
        id={"actions"}
        cell={({ row: { original } }) => {
          const isPreset = Boolean(original.spec.preset_key);
          if (isPreset) {
            return null;
          }
          return (
            <Table.Actions>
              <Table.EditAction
                title={t("buttons.edit")}
                row={original}
                resource="roles"
                icon={<Edit size={16} />}
              />
              <Table.DeleteAction
                title={t("buttons.delete")}
                row={original}
                resource="roles"
                icon={<Trash2 size={16} />}
              />
            </Table.Actions>
          );
        }}
      />
    ),
  };
};

export const RolesList = () => {
  const metadataColumns = useMetadataColumns();
  const roleColumns = useRoleColumns();

  return (
    <ListPage>
      <Table
        enableSorting
        enableFilters
        enableBatchDelete
        searchField="metadata->>name"
        refineCoreProps={{
          sorters: defaultSorters,
        }}
      >
        {roleColumns.name}
        {roleColumns.permissions}

        {metadataColumns.creation_timestamp}
        {roleColumns.action}
      </Table>
    </ListPage>
  );
};
