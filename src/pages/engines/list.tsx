import { ListPage, Table } from "@/components/theme";
import { useMetadataColumns } from "@/components/theme/table/columns/metadata-columns";
import { useEngineColumns } from "@/components/theme/table/columns/engine-columns";

export const EnginesList = () => {
	const metadataColumns = useMetadataColumns();
	const engineColumns = useEngineColumns();

	return (
		<ListPage canCreate={false}>
			<Table enableSorting enableFilters>
				{metadataColumns.name}
				{metadataColumns.workspace}
				{engineColumns.status}
				{engineColumns.versions}
				{metadataColumns.update_timestamp}
				{metadataColumns.creation_timestamp}
			</Table>
		</ListPage>
	);
};
