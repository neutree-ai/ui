import { type ReactNode, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { MemberProfile } from "@/domains/organization/types";
import { EmptyState } from "@/foundation/components/EmptyState";
import { EmptyValue } from "@/foundation/components/EmptyValue";
import { Loader } from "@/foundation/components/Loader";
import Timestamp from "@/foundation/components/Timestamp";
import { displayName } from "@/foundation/lib/display-name";
import { useTranslation } from "@/foundation/lib/i18n";
import type { ExtraColumn } from "@/foundation/types/extra-column";

export type MemberRow = {
  key: string;
  profile?: MemberProfile | null;
  /** Shown only when the table has a department column. */
  department?: string;
  /** Shown only when the table has a source column. */
  source?: string;
  since: string;
};

type MemberTableProps = {
  rows: MemberRow[];
  isLoading?: boolean;
  error?: string;
  showDepartment?: boolean;
  showSource?: boolean;
  sinceLabel: string;
  extraColumn?: ExtraColumn<MemberRow>;
  /** A trailing cell per row, e.g. a remove button. */
  renderActions?: (row: MemberRow) => ReactNode;
};

const sortRows = (rows: MemberRow[]) =>
  [...rows].sort((a, b) =>
    (a.profile ? displayName(a.profile.metadata) : "").localeCompare(
      b.profile ? displayName(b.profile.metadata) : "",
    ),
  );

export function MemberTable({
  rows,
  isLoading,
  error,
  showDepartment,
  showSource,
  sinceLabel,
  extraColumn,
  renderActions,
}: MemberTableProps) {
  const { t } = useTranslation();
  const sorted = useMemo(() => sortRows(rows), [rows]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Loader className="w-10 text-muted-foreground" />
      </div>
    );
  }
  if (error) {
    return (
      <EmptyState variant="inline" className="text-destructive">
        {error}
      </EmptyState>
    );
  }
  if (!rows.length) {
    return (
      <EmptyState variant="inline" data-testid="members-empty">
        {t("organization.members.empty")}
      </EmptyState>
    );
  }

  return (
    <Table data-testid="members-table">
      <TableHeader>
        <TableRow>
          <TableHead>{t("organization.fields.user")}</TableHead>
          <TableHead>{t("organization.fields.email")}</TableHead>
          {showDepartment && (
            <TableHead>{t("organization.fields.department")}</TableHead>
          )}
          {showSource && (
            <TableHead>{t("organization.fields.source")}</TableHead>
          )}
          <TableHead>{sinceLabel}</TableHead>
          {extraColumn && <TableHead>{extraColumn.header}</TableHead>}
          {renderActions && <TableHead className="w-0" />}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((row) => (
          <TableRow key={row.key}>
            <TableCell>
              {row.profile ? (
                <div className="flex flex-col">
                  <span>{displayName(row.profile.metadata)}</span>
                  {row.profile.metadata.display_name?.trim() && (
                    <span className="text-xs text-muted-foreground">
                      {row.profile.metadata.name}
                    </span>
                  )}
                </div>
              ) : (
                <EmptyValue />
              )}
            </TableCell>
            <TableCell>{row.profile?.spec?.email || <EmptyValue />}</TableCell>
            {showDepartment && (
              <TableCell>{row.department || <EmptyValue />}</TableCell>
            )}
            {showSource && (
              <TableCell>{row.source || <EmptyValue />}</TableCell>
            )}
            <TableCell>
              <Timestamp timestamp={row.since} relative />
            </TableCell>
            {extraColumn && <TableCell>{extraColumn.render(row)}</TableCell>}
            {renderActions && (
              <TableCell className="text-right">{renderActions(row)}</TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
