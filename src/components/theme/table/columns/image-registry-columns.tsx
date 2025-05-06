import ImageRegistryStatus from "@/components/business/ImageRegistryStatus";
import { Table } from "..";
import type { ImageRegistryPhase } from "@/types";

export const useImageRegistryColumns = () => {
	return {
		status: (
			<Table.Column
				header={"Status"}
				accessorKey="status.phase"
				id="status"
				enableHiding
				cell={({ getValue }) => {
					return (
						<ImageRegistryStatus
							phase={getValue() as unknown as ImageRegistryPhase}
						/>
					);
				}}
			/>
		),
	};
};
