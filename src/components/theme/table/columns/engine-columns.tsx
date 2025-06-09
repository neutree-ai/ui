import type { EnginePhase, EngineVersion } from "@/types";
import { Table } from "..";
import EngineStatus from "@/components/business/EngineStatus";
import EngineVersions from "@/components/business/EngineVersions";
import { useTranslate } from "@refinedev/core";

export const useEngineColumns = () => {
  const t = useTranslate();
  return {
    versions: (
      <Table.Column
        header={t("table.column.versions")}
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
        header={t("table.column.status")}
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
