import { ListPage } from "@/foundation/components/ListPage";
import { ShowButton } from "@/foundation/components/ShowButton";
import { Table, defaultSorters } from "@/foundation/components/Table";
import { useMetadataColumns } from "@/foundation/components/metadata-columns";
import { useTranslation } from "@/foundation/lib/i18n";
import { Edit, Lock, Trash2 } from "lucide-react";

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

        {metadataColumns.update_timestamp}
        {metadataColumns.creation_timestamp}
        {roleColumns.action}
      </Table>
    </ListPage>
  );
};
