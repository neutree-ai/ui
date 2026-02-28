import { EndpointPauseAction } from "@/components/business/EndpointPauseAction";
import { ModelTaskFilter } from "@/components/business/ModelTaskFilter";
import { useEndpointColumns } from "@/components/business/endpoint-columns";
import { useMetadataColumns } from "@/components/business/metadata-columns";
import { ListPage, Table } from "@/components/theme";
import { defaultSorters } from "@/components/theme/table";
import { useTranslation } from "react-i18next";

export const EndpointsList = () => {
  const { t } = useTranslation();
  const metadataColumns = useMetadataColumns({
    extraActions: (row) => <EndpointPauseAction endpoint={row} />,
  });
  const endpointColumns = useEndpointColumns();

  return (
    <ListPage title={t("endpoints.title")} breadcrumb={false}>
      <Table
        enableSorting
        enableFilters
        enableBatchDelete
        searchField="metadata->>name"
        refineCoreProps={{
          sorters: defaultSorters,
        }}
        filters={({ filters, setFilters }) => (
          <ModelTaskFilter filters={filters} setFilters={setFilters} />
        )}
      >
        {metadataColumns.name}
        {metadataColumns.workspace}
        {endpointColumns.status}
        {endpointColumns.model}
        {endpointColumns.task}
        {endpointColumns.engine}
        {endpointColumns.cluster}
        {metadataColumns.update_timestamp}
        {metadataColumns.creation_timestamp}
        {metadataColumns.action}
      </Table>
    </ListPage>
  );
};
