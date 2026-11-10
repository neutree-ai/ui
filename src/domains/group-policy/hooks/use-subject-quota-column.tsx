import type { ReactNode } from "react";
import { SubjectQuotaCell } from "@/domains/group-policy/components/SubjectQuotaCell";
import { useScopePolicyAccess } from "@/domains/group-policy/hooks/use-group-policies";
import type { PolicyScope, PrincipalKind } from "@/domains/group-policy/types";
import { useTranslation } from "@/foundation/lib/i18n";

type SubjectQuotaColumn = {
  header: string;
  render: (subject: {
    kind: PrincipalKind;
    id: string;
    label: string;
  }) => ReactNode;
};

/**
 * A "Limits" column for the users or applications a scope manages, when the
 * caller may read the scope's subject policies; undefined otherwise, or
 * without a scope.
 */
export const useSubjectQuotaColumn = (
  scope: (PolicyScope & { label: string }) | undefined,
): SubjectQuotaColumn | undefined => {
  const { t } = useTranslation();
  const access = useScopePolicyAccess(scope);
  if (!scope || !access.canRead) return undefined;
  return {
    header: t("group_policies.subject.column"),
    render: (subject) => (
      <SubjectQuotaCell
        key={`${scope.kind}/${scope.name}/${subject.id}`}
        scope={scope}
        subject={subject}
        access={access}
      />
    ),
  };
};
