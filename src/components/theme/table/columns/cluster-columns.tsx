import ClusterStatus from "@/components/business/ClusterStatus";
import { Table } from "..";
import type { ClusterPhase } from "@/types";
import { ShowButton } from "../../buttons";
import ClusterType from "@/components/business/ClusterType";

export const useClusterColumns = () => {
	return {
		type: (
			<Table.Column
				header={"Type"}
				accessorKey="spec.type"
				id="type"
				enableHiding
				cell={({ getValue }) => {
					const value = String(getValue());
					return <ClusterType type={value} />;
				}}
			/>
		),
		image_registry: (
			<Table.Column
				header={"Image Registry"}
				accessorKey="spec.image_registry"
				id="registry"
				enableHiding
				cell={({ row }) => {
					const { spec, metadata } = row.original;
					return (
						<ShowButton
							recordItemId={spec.image_registry}
							meta={{
								workspace: metadata.workspace,
							}}
							variant="link"
							resource="image_registries"
						>
							{spec.image_registry}
						</ShowButton>
					);
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
						<ClusterStatus phase={getValue() as unknown as ClusterPhase} />
					);
				}}
			/>
		),
	};
};
