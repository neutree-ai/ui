import { Table } from "..";

export const useUserColumns = () => {
	return {
		email: (
			<Table.Column
				header={"Email"}
				accessorKey="spec.email"
				id="email"
				enableHiding
			/>
		),
	};
};
