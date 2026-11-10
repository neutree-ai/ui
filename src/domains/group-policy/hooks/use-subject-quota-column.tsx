import { SubjectQuotaCell } from "@/domains/group-policy/components/SubjectQuotaCell";
import {
  useGroupPolicyWrites,
  useScopePolicyAccess,
} from "@/domains/group-policy/hooks/use-group-policies";
import type { PolicySubject } from "@/domains/group-policy/types";
import { useTranslation } from "@/foundation/lib/i18n";
import type { ExtraColumn } from "@/foundation/types/extra-column";
import type { LabeledScope } from "@/foundation/types/group-scope";

/**
 * A "Limits" column for the users or applications a scope manages, when the
 * caller may read the scope's subject policies; undefined otherwise, or
 * without a scope. `toSubject` names the subject of a row.
 */
export const useSubjectQuotaColumn = <Row,>(
  scope: LabeledScope | undefined,
  toSubject: (row: Row) => PolicySubject,
): ExtraColumn<Row> | undefined => {
  const { t } = useTranslation();
  const access = useScopePolicyAccess(scope);
  const writes = useGroupPolicyWrites();
  if (!scope || !access.canRead) return undefined;
  return {
    header: t("group_policies.subject.column"),
    render: (row) => {
      const subject = toSubject(row);
      return (
        <SubjectQuotaCell
          key={`${scope.kind}/${scope.name}/${subject.id}`}
          scope={scope}
          subject={subject}
          access={access}
          writes={writes}
        />
      );
    },
  };
};
