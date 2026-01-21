import Timestamp from "@/components/business/Timestamp";
import { ShowButton } from "@/components/theme/buttons";
import { useResource, useTranslation } from "@refinedev/core";
import { Edit, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { Table } from "..";

type MetadataColumnOptions = {
  resource?: string;
  // biome-ignore lint/suspicious/noExplicitAny: row can be any type
  extraActions?: (row: any) => ReactNode;
};

export const useMetadataColumns = (options?: MetadataColumnOptions) => {
  const { translate } = useTranslation();
  const { resource: hookResource } = useResource();

  const resource = options?.resource ?? hookResource?.name ?? "";

  return {
    name: (
      <Table.Column
        header={translate("common.fields.name")}
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
        header={translate("common.fields.workspace")}
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
        header={translate("common.fields.createdAt")}
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
        header={translate("common.fields.updatedAt")}
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
            {options?.extraActions?.(original)}
            <Table.EditAction
              title={translate("buttons.edit")}
              row={original}
              resource={resource}
              icon={<Edit size={16} />}
            />
            <Table.DeleteAction
              title={translate("buttons.delete")}
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
