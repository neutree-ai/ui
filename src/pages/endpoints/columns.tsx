import EndpointEngine from "@/domains/endpoint/components/EndpointEngine";
import EndpointModel from "@/domains/endpoint/components/EndpointModel";
import EndpointStatus from "@/domains/endpoint/components/EndpointStatus";
import ModelTask from "@/domains/endpoint/components/ModelTask";
import type { Endpoint } from "@/domains/endpoint/types";
import { ShowButton } from "@/foundation/components/ShowButton";
import { Table } from "@/foundation/components/Table";
import type { BaseStatus } from "@/foundation/types/basic-types";
import { useTranslate } from "@refinedev/core";

export const useEndpointColumns = () => {
  const t = useTranslate();
  return {
    model: (
      <Table.Column
        header={t("common.fields.model")}
        accessorKey="status"
        id="model"
        enableHiding
        cell={({ row }) => {
          const { model } = row.original.spec;
          return <EndpointModel model={model} />;
        }}
      />
    ),
    engine: (
      <Table.Column
        header={t("common.fields.engine")}
        accessorKey="spec.engine.engine"
        id="engine"
        enableHiding
        cell={({ row }) => {
          return <EndpointEngine {...(row.original as Endpoint)} />;
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
          return <EndpointStatus {...(getValue() as unknown as BaseStatus)} />;
        }}
      />
    ),
    cluster: (
      <Table.Column
        header={t("common.fields.cluster")}
        accessorKey="spec.cluster"
        id="cluster"
        enableHiding
        cell={({ row }) => {
          const {
            spec: { cluster },
            metadata,
          } = row.original;
          return (
            <ShowButton
              recordItemId={cluster}
              meta={{
                workspace: metadata.workspace,
              }}
              variant="link"
              resource="clusters"
            >
              {cluster}
            </ShowButton>
          );
        }}
      />
    ),
    task: (
      <Table.Column
        header={t("common.fields.task")}
        accessorKey="spec.model.task"
        id="task"
        enableHiding
        cell={({ row }) => {
          const { model } = row.original.spec;
          return <ModelTask task={model.task} />;
        }}
      />
    ),
  };
};
