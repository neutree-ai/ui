import { ListPage, Table } from "@/components/theme";
import { useEndpointColumns } from "@/components/theme/table/columns/endpoint-columns";
import { useMetadataColumns } from "@/components/theme/table/columns/metadata-columns";

export const EndpointsList = () => {
	const metadataColumns = useMetadataColumns();
	const endpointColumns = useEndpointColumns();

	return (
		<ListPage title="Endpoints" breadcrumb={false}>
			<Table enableSorting enableFilters>
				{metadataColumns.name}
				{metadataColumns.workspace}
				{endpointColumns.status}
				{endpointColumns.model}
				{endpointColumns.engine}
				{endpointColumns.cluster}
				{metadataColumns.update_timestamp}
				{metadataColumns.creation_timestamp}
				{metadataColumns.action}
			</Table>
		</ListPage>
	);
};
