import ModelRegistryType from "@/components/business/ModelRegistryType";
import { Table } from "..";
import ModelRegistryStatus from "@/components/business/ModelRegistryStatus";
import type { ModelRegistryPhase } from "@/types";

export const useModelRegistryColumns = () => {
	return {
		type: (
			<Table.Column
				header={"Type"}
				accessorKey="spec.type"
				id="type"
				enableHiding
				cell={({ getValue }) => {
					const value = String(getValue());
					return <ModelRegistryType type={value} />;
				}}
			/>
		),
		status: (
			<Table.Column
				header={"Status"}
				accessorKey="status.phase"
				id="status"
				enableHiding
				cell={({ getValue }) => {
					return (
						<ModelRegistryStatus
							phase={getValue() as unknown as ModelRegistryPhase}
						/>
					);
				}}
			/>
		),
	};
};
