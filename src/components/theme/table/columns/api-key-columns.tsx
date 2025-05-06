import { Trash2 } from "lucide-react";
import { Table } from "..";

export const useApiKeyColumns = () => {
	return {
		action: (
			<Table.Column
				accessorKey={"id"}
				id={"actions"}
				cell={({ row: { original } }) => (
					<Table.Actions>
						<Table.DeleteAction
							title="Delete"
							row={original}
							resource="api_keys"
							icon={<Trash2 size={16} />}
						/>
					</Table.Actions>
				)}
			/>
		),
	};
};
