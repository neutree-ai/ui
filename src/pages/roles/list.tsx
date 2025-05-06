import { ListPage, Table } from "@/components/theme";
import { useMetadataColumns } from "@/components/theme/table/columns/metadata-columns";
import { useRoleColumns } from "@/components/theme/table/columns/role-columns";

export const RolesList = () => {
	const metadataColumns = useMetadataColumns();
	const roleColumns = useRoleColumns();

	return (
		<ListPage>
			<Table enableSorting enableFilters>
				{roleColumns.name}
				{roleColumns.permissions}

				{metadataColumns.update_timestamp}
				{metadataColumns.creation_timestamp}
				{roleColumns.action}
			</Table>
		</ListPage>
	);
};
