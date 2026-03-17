import ExternalEndpointStatus from "@/domains/external-endpoint/components/ExternalEndpointStatus";
import { getExposedModels } from "@/domains/external-endpoint/lib/get-exposed-models";
import type { ExternalEndpoint } from "@/domains/external-endpoint/types";
import { ListPage } from "@/foundation/components/ListPage";
import { useMetadataColumns } from "@/foundation/components/metadata-columns";
import { defaultSorters, Table } from "@/foundation/components/Table";
import { useTranslation } from "@/foundation/lib/i18n";
import type { BaseStatus } from "@/foundation/types/basic-types";

export const ExternalEndpointsList = () => {
  const { t } = useTranslation();
  const metadataColumns = useMetadataColumns();

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
        {metadataColumns.name}
        {metadataColumns.workspace}
        <Table.Column
          header={t("common.fields.status")}
          accessorKey="status"
          id="status"
          enableHiding
          cell={({ getValue }) => (
            <ExternalEndpointStatus
              {...(getValue() as unknown as BaseStatus)}
            />
          )}
        />
        <Table.Column
          header={t("external_endpoints.fields.models")}
          accessorKey="spec"
          id="models"
          enableHiding
          cell={({ getValue }) => {
            const spec = getValue() as unknown as ExternalEndpoint["spec"];
            const models = getExposedModels(spec);
            if (models.length === 0) return "-";
            return (
              <div className="flex flex-wrap gap-1">
                {models.map((m) => (
                  <code
                    key={m}
                    className="rounded bg-muted px-1.5 py-0.5 text-xs"
                  >
                    {m}
                  </code>
                ))}
              </div>
            );
          }}
        />
        {metadataColumns.update_timestamp}
        {metadataColumns.creation_timestamp}
        {metadataColumns.action}
      </Table>
    </ListPage>
  );
};
