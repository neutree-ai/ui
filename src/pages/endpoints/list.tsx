import { EndpointPauseAction } from "@/domains/endpoint/components/EndpointPauseAction";
import { ModelTaskFilter } from "@/domains/endpoint/components/ModelTaskFilter";
import { ListPage } from "@/foundation/components/ListPage";
import { Table } from "@/foundation/components/Table";
import { defaultSorters } from "@/foundation/components/Table";
import { useMetadataColumns } from "@/foundation/components/metadata-columns";
import { useTranslation } from "react-i18next";
import { useEndpointColumns } from "./columns";

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
