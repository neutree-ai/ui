import EndpointEngine from "@/domains/endpoint/components/EndpointEngine";
import EndpointModel from "@/domains/endpoint/components/EndpointModel";
import { EndpointPauseAction } from "@/domains/endpoint/components/EndpointPauseAction";
import EndpointStatus from "@/domains/endpoint/components/EndpointStatus";
import ModelTask from "@/domains/endpoint/components/ModelTask";
import { ModelTaskFilter } from "@/domains/endpoint/components/ModelTaskFilter";
import type { Endpoint } from "@/domains/endpoint/types";
import { ListPage } from "@/foundation/components/ListPage";
import { ShowButton } from "@/foundation/components/ShowButton";
import { Table } from "@/foundation/components/Table";
import { defaultSorters } from "@/foundation/components/Table";
import { useMetadataColumns } from "@/foundation/components/metadata-columns";
import type { BaseStatus } from "@/foundation/types/basic-types";
import { useTranslate } from "@refinedev/core";
import { useTranslation } from "react-i18next";

export const EndpointsList = () => {
  const { t } = useTranslation();
  const tRefine = useTranslate();
  const metadataColumns = useMetadataColumns({
    extraActions: (row) => <EndpointPauseAction endpoint={row} />,
  });

  return (
    <ListPage title={t("endpoints.title")} breadcrumb={false}>
      <Table
        enableSorting
        enableFilters
        enableBatchDelete
        searchField="metadata->>name"
        refineCoreProps={{
          sorters: defaultSorters,
        }}
        filters={({ filters, setFilters }) => (
          <ModelTaskFilter filters={filters} setFilters={setFilters} />
        )}
      >
        {metadataColumns.name}
        {metadataColumns.workspace}
        <Table.Column
          header={tRefine("common.fields.status")}
          accessorKey="status"
          id="status"
          enableHiding
          cell={({ getValue }) => {
            return (
              <EndpointStatus {...(getValue() as unknown as BaseStatus)} />
            );
          }}
        />
        <Table.Column
          header={tRefine("common.fields.model")}
          accessorKey="status"
          id="model"
          enableHiding
          cell={({ row }) => {
            const { model } = row.original.spec;
            return <EndpointModel model={model} />;
          }}
        />
        <Table.Column
          header={tRefine("common.fields.task")}
          accessorKey="spec.model.task"
          id="task"
          enableHiding
          cell={({ row }) => {
            const { model } = row.original.spec;
            return <ModelTask task={model.task} />;
          }}
        />
        <Table.Column
          header={tRefine("common.fields.engine")}
          accessorKey="spec.engine.engine"
          id="engine"
          enableHiding
          cell={({ row }) => {
            return <EndpointEngine {...(row.original as Endpoint)} />;
          }}
        />
        <Table.Column
          header={tRefine("common.fields.cluster")}
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
        {metadataColumns.update_timestamp}
        {metadataColumns.creation_timestamp}
        {metadataColumns.action}
      </Table>
    </ListPage>
  );
};
