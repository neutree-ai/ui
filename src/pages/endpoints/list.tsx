import EndpointEngine from "@/domains/endpoint/components/EndpointEngine";
import EndpointModel from "@/domains/endpoint/components/EndpointModel";
import { EndpointPauseAction } from "@/domains/endpoint/components/EndpointPauseAction";
import {
  EndpointSaveAsCatalogAction,
  EndpointSaveAsCatalogProvider,
} from "@/domains/endpoint/components/EndpointSaveAsCatalogAction";
import ModelTask from "@/domains/endpoint/components/ModelTask";
import { ModelTaskFilter } from "@/domains/endpoint/components/ModelTaskFilter";
import type { Endpoint } from "@/domains/endpoint/types";
import EndpointStatus from "@/foundation/components/EndpointStatus";
import { ListPage } from "@/foundation/components/ListPage";
import { ModelSourceBadge } from "@/foundation/components/ModelSourceBadge";
import { useMetadataColumns } from "@/foundation/components/metadata-columns";
import { ShowButton } from "@/foundation/components/ShowButton";
import { Table } from "@/foundation/components/Table";
import { useTranslation } from "@/foundation/lib/i18n";
import { resolveModelSource } from "@/foundation/lib/model-source";
import type { BaseStatus } from "@/foundation/types/basic-types";

export const EndpointsList = () => {
  const { t } = useTranslation();
  const metadataColumns = useMetadataColumns({
    extraActions: (row) => (
      <>
        <EndpointPauseAction endpoint={row} />
        <EndpointSaveAsCatalogAction endpoint={row} />
      </>
    ),
  });

  return (
    <EndpointSaveAsCatalogProvider>
      <ListPage title={t("endpoints.title")} breadcrumb={false}>
        <Table
          enableSorting
          enableFilters
          enableBatchDelete
          searchField="metadata->>name"
          refineCoreProps={{
            sorters: {
              initial: [
                { field: "status_sort_priority", order: "asc" },
                { field: "metadata->creation_timestamp", order: "desc" },
              ],
            },
          }}
          filters={({ filters, setFilters }) => (
            <ModelTaskFilter filters={filters} setFilters={setFilters} />
          )}
        >
          {metadataColumns.name}
          {metadataColumns.workspace}
          <Table.Column
            header={t("common.fields.status")}
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
            header={t("common.fields.model")}
            accessorKey="status"
            id="model"
            enableHiding
            cell={({ row }) => {
              const { model } = (row.original as Endpoint).spec;
              return (
                // The badge rides with the model name, as it does on the
                // external endpoint list: the source is a property of the
                // model, and a column of its own would repeat one value down
                // the whole page — an internal endpoint is run by the platform,
                // so it is always self-hosted.
                <div className="flex items-center gap-1">
                  <EndpointModel model={model} />
                  <ModelSourceBadge source={resolveModelSource("internal")} />
                </div>
              );
            }}
          />
          <Table.Column
            header={t("common.fields.task")}
            accessorKey="spec.model.task"
            id="task"
            enableHiding
            cell={({ row }) => {
              const { model } = (row.original as Endpoint).spec;
              return <ModelTask task={model?.task} />;
            }}
          />
          <Table.Column
            header={t("common.fields.engine")}
            accessorKey="spec.engine.engine"
            id="engine"
            enableHiding
            cell={({ row }) => {
              return <EndpointEngine {...(row.original as Endpoint)} />;
            }}
          />
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
          {metadataColumns.creation_timestamp}
          {metadataColumns.action}
        </Table>
      </ListPage>
    </EndpointSaveAsCatalogProvider>
  );
};
