import { IdentitySourceEnabledSwitch } from "@/domains/identity-source/components/IdentitySourceEnabledSwitch";
import { IdentitySourceStatus } from "@/domains/identity-source/components/IdentitySourceStatus";
import type { IdentitySource } from "@/domains/identity-source/types";
import { ListPage } from "@/foundation/components/ListPage";
import { useMetadataColumns } from "@/foundation/components/metadata-columns";
import { defaultSorters, Table } from "@/foundation/components/Table";
import { useTranslation } from "@/foundation/lib/i18n";

export const IdentitySourcesList = () => {
  const { t } = useTranslation();
  const metadataColumns = useMetadataColumns();

  return (
    <ListPage>
      <Table
        enableSorting
        enableFilters
        searchField="metadata->>name"
        refineCoreProps={{
          sorters: defaultSorters,
          // The controller rewrites status after each connection test.
          queryOptions: { refetchInterval: 10_000 },
        }}
      >
        {metadataColumns.name}
        <Table.Column
          header={t("identity_sources.fields.displayName")}
          accessorKey="metadata.display_name"
          id="display_name"
          enableHiding
          cell={({ row }) => {
            const { display_name, name } = (row.original as IdentitySource)
              .metadata;
            return display_name || name;
          }}
        />
        <Table.Column
          header={t("common.fields.type")}
          accessorKey="spec.type"
          id="type"
          enableHiding
          cell={({ row }) => {
            const type = (row.original as IdentitySource).spec?.type;
            return type ? t(`identity_sources.types.${type}`) : "-";
          }}
        />
        <Table.Column
          header={t("identity_sources.fields.enabled")}
          accessorKey="spec.enabled"
          id="enabled"
          enableHiding
          cell={({ row }) => (
            <IdentitySourceEnabledSwitch
              record={row.original as IdentitySource}
            />
          )}
        />
        <Table.Column
          header={t("common.fields.status")}
          accessorKey="status"
          id="status"
          enableHiding
          cell={({ row }) => (
            <IdentitySourceStatus
              status={(row.original as IdentitySource).status}
            />
          )}
        />
        {metadataColumns.creation_timestamp}
        {metadataColumns.action}
      </Table>
    </ListPage>
  );
};
