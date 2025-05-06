import { ListPage, Table } from "@/components/theme";
import { useImageRegistryColumns } from "@/components/theme/table/columns/image-registry-columns";
import { useMetadataColumns } from "@/components/theme/table/columns/metadata-columns";

export const ImageRegistriesList = () => {
	const metadataColumns = useMetadataColumns();
	const imageRegistryColumns = useImageRegistryColumns();

	return (
		<ListPage>
			<Table enableSorting enableFilters>
				{metadataColumns.name}
				{metadataColumns.workspace}
				{imageRegistryColumns.status}
				{metadataColumns.update_timestamp}
				{metadataColumns.creation_timestamp}
				{metadataColumns.action}
			</Table>
		</ListPage>
	);
};
