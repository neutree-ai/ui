import { useResource, useTranslation } from "@refinedev/core";
import { ShowButton } from "@/components/theme/buttons";
import Timestamp from "@/components/business/Timestamp";
import { Edit, Trash2 } from "lucide-react";
import { Table } from "..";

export const useMetadataColumns = (options?: { resource: string }) => {
  const { translate } = useTranslation();
  const { resource: hookResource } = useResource();

  const resource = options?.resource ?? hookResource?.name ?? "";

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
        header={"Workspace"}
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
        cell={({ row: { original } }) => (
          <Table.Actions>
            <Table.EditAction
              title="Edit"
              row={original}
              resource={resource}
              icon={<Edit size={16} />}
            />
            <Table.DeleteAction
              title="Delete"
              row={original}
              resource={resource}
              icon={<Trash2 size={16} />}
            />
          </Table.Actions>
        )}
      />
    ),
  };
};
