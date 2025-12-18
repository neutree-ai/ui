import Timestamp from "@/components/business/Timestamp";
import { ShowButton } from "@/components/theme/buttons";
import {
  copyYamlToClipboard,
  downloadYamlFile,
  generateEntityFilename,
  generateYamlContentFromEntity,
  getDefaultExportOptions,
} from "@/lib/yaml-utils";
import { useResource, useTranslation } from "@refinedev/core";
import { Download, Edit, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { Table } from "..";

type MetadataColumnOptions = {
  resource?: string;
  // biome-ignore lint/suspicious/noExplicitAny: row can be any type
  extraActions?: (row: any) => ReactNode;
  // Control which default actions to show - can be boolean or function
  showEditAction?: boolean | ((row: any) => boolean);
  showDeleteAction?: boolean | ((row: any) => boolean);
  showExportAction?: boolean | ((row: any) => boolean);
};

export const useMetadataColumns = (options?: MetadataColumnOptions) => {
  const { translate } = useTranslation();
  const { resource: hookResource } = useResource();

  const resource = options?.resource ?? hookResource?.name ?? "";

  // Export single entity as YAML
  const handleExportEntity = async (entity: any) => {
    // Emit custom event to trigger global dialog
    const event = new CustomEvent("export-yaml", {
      detail: { entity, resource },
    });
    window.dispatchEvent(event);
  };

  return {
    name: (
      <Table.Column
        header={translate("table.column.name")}
        accessorKey="metadata.name"
        id="metadata->name"
        enableSorting
        cell={({ row }) => {
          const { name, workspace } = row.original.metadata;
          return (
            <ShowButton
              recordItemId={name}
              variant="link"
              meta={{
                workspace,
              }}
              resource={resource}
            >
              {name}
            </ShowButton>
          );
        }}
      />
    ),
    workspace: (
      <Table.Column
        header={translate("table.column.workspace")}
        accessorKey="metadata.workspace"
        id="workspace"
        enableHiding
        cell={({ row }) => {
          const { workspace } = row.original.metadata;
          return (
            <ShowButton
              recordItemId={workspace}
              meta={{}}
              variant="link"
              resource="workspaces"
            >
              {workspace}
            </ShowButton>
          );
        }}
      />
    ),
    creation_timestamp: (
      <Table.Column
        header={translate("table.column.creation_timestamp")}
        accessorKey="metadata.creation_timestamp"
        id="metadata->creation_timestamp"
        enableSorting
        enableHiding
        cell={({ row }) => {
          const { creation_timestamp } = row.original.metadata;
          return <Timestamp timestamp={creation_timestamp} />;
        }}
      />
    ),
    update_timestamp: (
      <Table.Column
        header={translate("table.column.update_timestamp")}
        accessorKey="metadata.update_timestamp"
        id="metadata->update_timestamp"
        enableSorting
        enableHiding
        cell={({ row }) => {
          const { update_timestamp } = row.original.metadata;
          return <Timestamp timestamp={update_timestamp} />;
        }}
      />
    ),
    action: (
      <Table.Column
        accessorKey={"id"}
        id={"actions"}
        cell={({ row: { original } }) => {
          const extraActionsResult = options?.extraActions?.(original);
          // 如果extraActions返回null，隐藏所有action
          if (extraActionsResult === null) {
            return null;
          }
          return (
            <>
              <Table.Actions>
                {extraActionsResult}
                {(() => {
                  const showExport =
                    typeof options?.showExportAction === "function"
                      ? options.showExportAction(original)
                      : (options?.showExportAction ?? true);
                  return (
                    showExport && (
                      <Table.Action
                        title={translate("buttons.exportYaml")}
                        icon={<Download size={16} />}
                        onClick={() => handleExportEntity(original)}
                      />
                    )
                  );
                })()}
                {(() => {
                  const showEdit =
                    typeof options?.showEditAction === "function"
                      ? options.showEditAction(original)
                      : (options?.showEditAction ?? true);
                  return (
                    showEdit && (
                      <Table.EditAction
                        title={translate("buttons.edit")}
                        row={original}
                        resource={resource}
                        icon={<Edit size={16} />}
                      />
                    )
                  );
                })()}
                {(() => {
                  const showDelete =
                    typeof options?.showDeleteAction === "function"
                      ? options.showDeleteAction(original)
                      : (options?.showDeleteAction ?? true);
                  return (
                    showDelete && (
                      <Table.DeleteAction
                        title={translate("buttons.delete")}
                        row={original}
                        resource={resource}
                        icon={<Trash2 size={16} />}
                      />
                    )
                  );
                })()}
              </Table.Actions>
            </>
          );
        }}
      />
    ),
  };
};
