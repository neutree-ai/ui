import { Network, User, Users } from "lucide-react";
import type { ReactNode } from "react";
import UserCell from "@/domains/role-assignment/components/UserCell";
import { subjectKindOf } from "@/domains/role-assignment/lib/subject";
import type {
  RoleAssignmentSpec,
  RoleAssignmentSubjectKind,
} from "@/domains/role-assignment/types";
import { useTranslation } from "@/foundation/lib/i18n";

/** Group renderers, supplied by the page from the organization domain. */
export type GroupRenderers = {
  renderTeam?: (name: string) => ReactNode;
  renderOrgUnit?: (name: string) => ReactNode;
};

const ICONS = { User, Team: Users, OrgUnit: Network } as const;

export const SUBJECT_KIND_KEYS: Record<RoleAssignmentSubjectKind, string> = {
  User: "role_assignments.subjectKinds.User",
  Team: "role_assignments.subjectKinds.Team",
  OrgUnit: "role_assignments.subjectKinds.OrgUnit",
};

export function SubjectKindIcon({ kind }: { kind: RoleAssignmentSubjectKind }) {
  const { t } = useTranslation();
  const Icon = ICONS[kind];
  const label = t(SUBJECT_KIND_KEYS[kind]);
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="inline-flex shrink-0 text-muted-foreground"
      data-testid={`subject-kind-${kind}`}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </span>
  );
}

/** The subject of an assignment: a kind icon and the user or group. */
export function RoleAssignmentSubjectLabel({
  spec,
  renderTeam = (name) => name,
  renderOrgUnit = (name) => name,
}: { spec: RoleAssignmentSpec } & GroupRenderers) {
  const kind = subjectKindOf(spec);
  const name = spec.subject_name ?? "";
  return (
    <span
      className="inline-flex items-center gap-1.5"
      data-testid="role-assignment-subject"
    >
      <SubjectKindIcon kind={kind} />
      {kind === "User"
        ? spec.user_id && <UserCell id={spec.user_id} />
        : kind === "Team"
          ? renderTeam(name)
          : renderOrgUnit(name)}
    </span>
  );
}
