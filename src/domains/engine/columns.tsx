import { Table } from "@/foundation/components/Table";
import type { BaseStatus, EngineVersion } from "@/foundation/types";
import { useTranslate } from "@refinedev/core";
import EngineStatus from "./EngineStatus";
import EngineVersions from "./EngineVersions";

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
