import EndpointEngine from "@/domains/endpoint/components/EndpointEngine";
import EndpointModel from "@/domains/endpoint/components/EndpointModel";
import { EndpointPauseAction } from "@/domains/endpoint/components/EndpointPauseAction";
import {
  EndpointSaveAsCatalogAction,
  EndpointSaveAsCatalogProvider,
} from "@/domains/endpoint/components/EndpointSaveAsCatalogAction";
import ModelTask from "@/domains/endpoint/components/ModelTask";
import { ModelTaskFilter } from "@/domains/endpoint/components/ModelTaskFilter";
import { endpointModelRef } from "@/domains/endpoint/lib/endpoint-display-model";
import type { Endpoint } from "@/domains/endpoint/types";
import { endpointPhases } from "@/foundation/endpoint-phase/endpoint-phases";
import { useTranslation } from "@/foundation/lib/i18n";
import { ModelSourceBadge } from "@/foundation/model-reference/ModelSourceBadge";
import { SELF_HOSTED_MODEL_SOURCE } from "@/foundation/model-reference/model-source";
import { PhaseStatus } from "@/foundation/role/PhaseStatus";
import { ListPage } from "@/foundation/scene/ListPage";
import { useMetadataColumns } from "@/foundation/scene/metadata-columns";
import { ShowButton } from "@/foundation/scene/ShowButton";
import { Table } from "@/foundation/scene/Table";
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
            // Status first, newest first inside a rank. Product decision: the
            // default leads with the states an operator acts on, not with the
            // newest row. The ranks themselves belong to
            // `status_sort_priority` in the database, so moving failed ahead of
            // paused is a migration, not a line here.
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
                <PhaseStatus
                  status={getValue() as unknown as BaseStatus}
                  phases={endpointPhases}
                />
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
                // No model, no source: a Flex endpoint shows "-" alone rather
                // than labelling a model it does not have.
                <div className="flex items-center gap-1">
                  <EndpointModel model={model} />
                  {endpointModelRef(model) && (
                    <ModelSourceBadge source={SELF_HOSTED_MODEL_SOURCE} />
                  )}
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
