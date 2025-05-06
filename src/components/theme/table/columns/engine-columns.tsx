import type { EnginePhase, EngineVersion } from "@/types";
import { Table } from "..";
import EngineStatus from "@/components/business/EngineStatus";
import EngineVersions from "@/components/business/EngineVersions";

export const useEngineColumns = () => {
	return {
		versions: (
			<Table.Column
				header={"Versions"}
				accessorKey="spec.versions"
				id="version"
				enableHiding
				cell={({ getValue }) => {
					return (
						<EngineVersions
							versions={getValue() as unknown as EngineVersion[]}
						/>
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
					return <EngineStatus phase={getValue() as unknown as EnginePhase} />;
				}}
			/>
		),
	};
};
