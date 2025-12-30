import EngineStatus from "@/components/business/EngineStatus";
import EngineVersions from "@/components/business/EngineVersions";
import type { BaseStatus, EngineVersion } from "@/types";
import { useTranslate } from "@refinedev/core";
import { Download } from "lucide-react";
import { Table } from "..";

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
        accessorKey="status"
        id="status"
        enableHiding
        cell={({ getValue }) => {
          return <EngineStatus {...(getValue() as unknown as BaseStatus)} />;
        }}
      />
    ),
    action: (
      <Table.Column
        accessorKey={"id"}
        id={"actions"}
        cell={({ row: { original } }) => (
          <Table.Actions>
            <Table.ExportYamlAction
              row={original}
              resource="engines"
              icon={<Download size={16} />}
            />
          </Table.Actions>
        )}
      />
    ),
  };
};
