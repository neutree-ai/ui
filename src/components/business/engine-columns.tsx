import EngineStatus from "@/components/business/EngineStatus";
import EngineVersions from "@/components/business/EngineVersions";
import { Table } from "@/components/business/Table";
import type { BaseStatus, EngineVersion } from "@/types";
import { useTranslate } from "@refinedev/core";

export const useEngineColumns = () => {
  const t = useTranslate();
  return {
    versions: (
      <Table.Column
        header={t("common.fields.versions")}
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
        header={t("common.fields.status")}
        accessorKey="status"
        id="status"
        enableHiding
        cell={({ getValue }) => {
          return <EngineStatus {...(getValue() as unknown as BaseStatus)} />;
        }}
      />
    ),
  };
};
