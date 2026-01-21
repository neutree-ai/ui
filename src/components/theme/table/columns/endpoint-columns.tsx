import EndpointEngine from "@/components/business/EndpointEngine";
import EndpointModel from "@/components/business/EndpointModel";
import EndpointStatus from "@/components/business/EndpointStatus";
import ModelTask from "@/components/business/ModelTask";
import type { BaseStatus, Endpoint } from "@/types";
import { useTranslate } from "@refinedev/core";
import { Table } from "..";
import { ShowButton } from "../../buttons";

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
