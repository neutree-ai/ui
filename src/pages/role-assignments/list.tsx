import { ListPage, Table } from "@/components/theme";
import { useMetadataColumns } from "@/components/theme/table/columns/metadata-columns";
import { useRoleAssignmentColumns } from "@/components/theme/table/columns/role-assignment-columns";

export const RoleAssignmentsList = () => {
	const metadataColumns = useMetadataColumns();
	const roleAssignmentColumns = useRoleAssignmentColumns();

	return (
		<ListPage>
			<Table enableSorting enableFilters>
				{metadataColumns.name}
				{roleAssignmentColumns.workspace}
				{roleAssignmentColumns.role}
				{roleAssignmentColumns.user}
				{metadataColumns.update_timestamp}
				{metadataColumns.creation_timestamp}
				{metadataColumns.action}
			</Table>
		</ListPage>
	);
};
