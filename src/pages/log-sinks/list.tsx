import { Edit, Trash2 } from "lucide-react";
import { LogSinkEnableAction } from "@/domains/log-sink/components/LogSinkEnableAction";
import LogSinkEnabled from "@/domains/log-sink/components/LogSinkEnabled";
import LogSinkStatus from "@/domains/log-sink/components/LogSinkStatus";
import { useLogSinkDeleteConfirmation } from "@/domains/log-sink/hooks/use-log-sink-delete-confirmation";
import {
  formatEventCount,
  formatLogSinkDestination,
} from "@/domains/log-sink/lib/log-sink-display";
import type { LogSink } from "@/domains/log-sink/types";
import { AppBreadcrumbs } from "@/foundation/components/AppBreadcrumbs";
import { ListPage } from "@/foundation/components/ListPage";
import { useMetadataColumns } from "@/foundation/components/metadata-columns";
import { Table } from "@/foundation/components/Table";
import Timestamp from "@/foundation/components/Timestamp";
import { useTranslation } from "@/foundation/lib/i18n";
import type { BaseStatus } from "@/foundation/types/basic-types";

// Columns and order: src/domains/log-sink/data.md (List).
export const LogSinksList = () => {
  const { t } = useTranslation();
  const metadataColumns = useMetadataColumns();
  const deleteConfirmation = useLogSinkDeleteConfirmation();

  return (
    <ListPage
      breadcrumb={<AppBreadcrumbs showCurrent={false} />}
      createButtonProps={{ children: t("log_sinks.buttons.addDestination") }}
    >
      <Table
        enableSorting
        enableFilters
        searchField="metadata->>name"
        emptyText={t("log_sinks.empty")}
        refineCoreProps={{
          sorters: {
            initial: [{ field: "metadata->name", order: "asc" }],
          },
        }}
      >
        {metadataColumns.name}
        <Table.Column
          header={t("log_sinks.fields.type")}
          accessorKey="spec.type"
          id="type"
          enableHiding
          cell={({ row }) =>
            t(`log_sinks.types.${(row.original as LogSink).spec?.type}`)
          }
        />
        <Table.Column
          header={t("log_sinks.sections.destination")}
          accessorKey="spec"
          id="destination"
          enableHiding
          cell={({ row }) => {
            const { primary, secondary } = formatLogSinkDestination(
              (row.original as LogSink).spec,
            );
            return (
              <div className="flex flex-col">
                <span className="break-all">{primary}</span>
                {secondary && (
                  <span className="text-xs text-muted-foreground">
                    {secondary}
                  </span>
                )}
              </div>
            );
          }}
        />
        <Table.Column
          header={t("common.fields.status")}
          accessorKey="status"
          id="status"
          enableHiding
          cell={({ getValue }) => (
            <LogSinkStatus {...(getValue() as unknown as BaseStatus)} />
          )}
        />
        <Table.Column
          header={t("log_sinks.fields.enabled")}
          accessorKey="spec.enabled"
          id="enabled"
          enableHiding
          cell={({ row }) => (
            <LogSinkEnabled enabled={(row.original as LogSink).spec?.enabled} />
          )}
        />
        <Table.Column
          header={t("log_sinks.fields.sentEvents")}
          accessorKey="status.sent_events"
          id="sent_events"
          enableHiding
          cell={({ row }) =>
            formatEventCount((row.original as LogSink).status?.sent_events)
          }
        />
        <Table.Column
          header={t("log_sinks.fields.droppedEvents")}
          accessorKey="status.dropped_events"
          id="dropped_events"
          enableHiding
          cell={({ row }) =>
            formatEventCount((row.original as LogSink).status?.dropped_events)
          }
        />
        <Table.Column
          header={t("log_sinks.fields.lastSentTime")}
          accessorKey="status.last_sent_time"
          id="last_sent_time"
          enableHiding
          cell={({ row }) => (
            <Timestamp
              timestamp={(row.original as LogSink).status?.last_sent_time}
              relative
            />
          )}
        />
        <Table.Column
          accessorKey="id"
          id="actions"
          cell={({ row: { original } }) => (
            <Table.Actions>
              <Table.EditAction
                title={t("buttons.edit")}
                row={original}
                resource="log_sinks"
                icon={<Edit size={16} />}
              />
              <LogSinkEnableAction sink={original as LogSink} />
              <Table.DeleteAction
                title={t("buttons.delete")}
                row={original}
                resource="log_sinks"
                icon={<Trash2 size={16} />}
                confirmation={deleteConfirmation(
                  (original as LogSink).metadata.name,
                )}
              />
            </Table.Actions>
          )}
        />
      </Table>
    </ListPage>
  );
};
