import EndpointModel from "@/components/business/EndpointModel";
import { Table } from "..";
import { ShowButton } from "../../buttons";
import EndpointEngine from "@/components/business/EndpointEngine";
import EndpointStatus from "@/components/business/EndpointStatus";
import type { Endpoint, EndpointPhase } from "@/types";

export const useEndpointColumns = () => {
  return {
    model: (
      <Table.Column
        header={"Model"}
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
        header={"Engine"}
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
        header={"Status"}
        accessorKey="status.phase"
        id="status"
        enableHiding
        cell={({ getValue }) => {
          return (
            <EndpointStatus phase={getValue() as unknown as EndpointPhase} />
          );
        }}
      />
    ),
    cluster: (
      <Table.Column
        header={"Cluster"}
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
  };
};
