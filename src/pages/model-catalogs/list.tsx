import { Download, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import EndpointEngine from "@/domains/endpoint/components/EndpointEngine";
import EndpointModel from "@/domains/endpoint/components/EndpointModel";
import ModelTask from "@/domains/endpoint/components/ModelTask";
import { ModelTaskFilter } from "@/domains/endpoint/components/ModelTaskFilter";
import ModelCatalogStatus from "@/domains/model-catalog/components/ModelCatalogStatus";
import { ListPage } from "@/foundation/components/ListPage";
import { useMetadataColumns } from "@/foundation/components/metadata-columns";
import { defaultSorters, Table } from "@/foundation/components/Table";
import { useTranslation } from "@/foundation/lib/i18n";
import type { BaseStatus } from "@/foundation/types/basic-types";
import type { ModelSpec } from "@/foundation/types/serving-types";
import { ImportDialog } from "./components/ImportDialog";

// pickRepresentativeModel returns the model for the list row's Model/Task
// columns. For a recipe MC (no top-level spec.model) it falls back to the
// first variant's model — list display only needs *a* representative entry.
function pickRepresentativeModel(spec: {
  model?: ModelSpec | null;
  variants?: Record<string, { model?: ModelSpec | null } | null> | null;
}): ModelSpec | null {
  if (spec.model) return spec.model;
  for (const v of Object.values(spec.variants ?? {})) {
    if (v?.model) return v.model;
  }
  return null;
}

export const ModelCatalogsList = () => {
  const { t } = useTranslation();
  const metadataColumns = useMetadataColumns();
  const [importOpen, setImportOpen] = useState(false);

  return (
    <ListPage
      canCreate={false}
      extra={
        <Button size="sm" onClick={() => setImportOpen(true)}>
          <Download className="size-4 mr-1.5 rotate-180" />
          {t("model_catalogs.import.button", "Import")}
        </Button>
      }
    >
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
          header={t("common.fields.model")}
          accessorKey="spec.model.name"
          id="model"
          enableHiding
          cell={({ row }) => {
            const model = pickRepresentativeModel(row.original.spec);
            return model ? (
              <EndpointModel model={model} />
            ) : (
              <span className="text-muted-foreground">—</span>
            );
          }}
        />
        <Table.Column
          header={t("common.fields.task")}
          accessorKey="spec.model.task"
          id="task"
          enableHiding
          cell={({ row }) => {
            const model = pickRepresentativeModel(row.original.spec);
            return model ? (
              <ModelTask task={model.task} />
            ) : (
              <span className="text-muted-foreground">—</span>
            );
          }}
        />
        <Table.Column
          header={t("common.fields.engine")}
          accessorKey="spec.engine.engine"
          id="engine"
          enableHiding
          cell={({ row }) => {
            const { spec, metadata } = row.original;
            return <EndpointEngine spec={spec} metadata={metadata} />;
          }}
        />
        <Table.Column
          header={t("common.fields.status")}
          accessorKey="status"
          id="status"
          enableHiding
          cell={({ getValue }) => {
            return (
              <ModelCatalogStatus {...(getValue() as unknown as BaseStatus)} />
            );
          }}
        />
        {metadataColumns.update_timestamp}
        {metadataColumns.creation_timestamp}
        <Table.Column
          accessorKey={"id"}
          id={"actions"}
          cell={({ row: { original } }) => (
            <Table.Actions>
              <Table.DeleteAction
                title={t("buttons.delete")}
                row={original}
                resource="model_catalogs"
                icon={<Trash2 size={16} />}
              />
            </Table.Actions>
          )}
        />
      </Table>
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </ListPage>
  );
};
