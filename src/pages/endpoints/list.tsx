import { ModelTaskFilter } from "@/components/business/ModelTaskFilter";
import { ListPage, Table } from "@/components/theme";
import { useEndpointColumns } from "@/components/theme/table/columns/endpoint-columns";
import { useMetadataColumns } from "@/components/theme/table/columns/metadata-columns";
import { defaultSorters } from "@/components/theme/table/sorter";
import { useTranslation } from "react-i18next";

export const EndpointsList = () => {
  const { t } = useTranslation();
  const metadataColumns = useMetadataColumns();
  const endpointColumns = useEndpointColumns();

  return (
    <ListPage title={t("endpoints.title")} breadcrumb={false}>
      <Table
        enableSorting
        enableFilters
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
