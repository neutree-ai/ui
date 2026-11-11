import { SubjectQuotaCell } from "@/domains/group-policy/components/SubjectQuotaCell";
import {
  subjectKey,
  useGroupPolicyWrites,
  useScopePolicyAccess,
  useScopeSubjectPolicies,
} from "@/domains/group-policy/hooks/use-group-policies";
import type { PolicySubject } from "@/domains/group-policy/types";
import { useTranslation } from "@/foundation/lib/i18n";
import type { ExtraColumn } from "@/foundation/types/extra-column";
import type { LabeledScope } from "@/foundation/types/group-scope";

// A scope with no name disables the read.
const NO_SCOPE = { kind: "Team", name: "" } as const;

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
  // One read for the whole column; each cell looks up its row.
  const { bySubject, isLoading } = useScopeSubjectPolicies(
    scope ?? NO_SCOPE,
    !!scope && access.canRead,
  );
  if (!scope || !access.canRead) return undefined;
  return {
    header: t("group_policies.subject.column"),
    render: (row) => {
      if (isLoading) return null;
      const subject = toSubject(row);
      return (
        <SubjectQuotaCell
          key={`${scope.kind}/${scope.name}/${subject.id}`}
          scope={scope}
          subject={subject}
          policy={bySubject?.get(subjectKey(subject.kind, subject.id))}
          access={access}
          writes={writes}
        />
      );
    },
  };
};
