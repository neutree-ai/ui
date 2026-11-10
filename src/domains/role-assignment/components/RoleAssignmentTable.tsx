import type { ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RoleAssignmentScopeLabel } from "@/domains/role-assignment/components/RoleAssignmentScopeLabel";
import type { GroupRenderers } from "@/domains/role-assignment/components/RoleAssignmentSubjectLabel";
import type { RoleAssignmentSpec } from "@/domains/role-assignment/types";
import { EmptyState } from "@/foundation/components/EmptyState";
import { Loader } from "@/foundation/components/Loader";
import { ShowButton } from "@/foundation/components/ShowButton";
import { useTranslation } from "@/foundation/lib/i18n";

type RoleAssignmentRow = {
  key: string;
  name: string;
  spec: RoleAssignmentSpec;
  /** Shown in an extra column when `sourceHeader` is set. */
  source?: ReactNode;
};

/** A compact, unpaged list of role assignments for a detail panel. */
export function RoleAssignmentTable({
  rows,
  isLoading,
  error,
  emptyText,
  sourceHeader,
  renderOrgUnit,
  "data-testid": testId,
}: {
  rows: RoleAssignmentRow[];
  isLoading?: boolean;
  error?: string;
  emptyText: string;
  sourceHeader?: string;
  "data-testid"?: string;
} & Pick<GroupRenderers, "renderOrgUnit">) {
  const { t } = useTranslation();

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
      <EmptyState variant="inline" data-testid={testId && `${testId}-empty`}>
        {emptyText}
      </EmptyState>
    );
  }

  return (
    <Table data-testid={testId}>
      <TableHeader>
        <TableRow>
          <TableHead>{t("common.fields.name")}</TableHead>
          <TableHead>{t("common.fields.role")}</TableHead>
          <TableHead>{t("role_assignments.fields.scope")}</TableHead>
          {sourceHeader && <TableHead>{sourceHeader}</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.key}>
            <TableCell>
              <ShowButton
                recordItemId={row.name}
                meta={{}}
                variant="link"
                resource="role_assignments"
              >
                {row.name}
              </ShowButton>
            </TableCell>
            <TableCell>
              <ShowButton
                recordItemId={row.spec.role}
                meta={{}}
                variant="link"
                resource="roles"
              >
                {row.spec.role}
              </ShowButton>
            </TableCell>
            <TableCell>
              <RoleAssignmentScopeLabel
                spec={row.spec}
                renderOrgUnit={renderOrgUnit}
              />
            </TableCell>
            {sourceHeader && <TableCell>{row.source}</TableCell>}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
