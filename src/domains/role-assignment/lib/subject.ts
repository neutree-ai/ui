import type {
  RoleAssignmentSpec,
  RoleAssignmentSubjectKind,
} from "@/domains/role-assignment/types";

type SubjectFields = Pick<
  RoleAssignmentSpec,
  "user_id" | "subject_kind" | "subject_name"
>;

export const subjectKindOf = (
  spec: Pick<RoleAssignmentSpec, "subject_kind">,
): RoleAssignmentSubjectKind => spec.subject_kind || "User";

/**
 * The subject fields for a kind. A group subject has no user_id: the server
 * refuses one (10293). Switching keeps the picked subject only within a kind.
 */
export const subjectFields = (
  kind: RoleAssignmentSubjectKind,
  current: SubjectFields,
): Required<SubjectFields> => {
  const same = subjectKindOf(current) === kind;
  if (kind === "User") {
    return {
      subject_kind: "User",
      subject_name: null,
      user_id: same ? (current.user_id ?? "") : "",
    };
  }
  return {
    subject_kind: kind,
    subject_name: same ? (current.subject_name ?? "") : "",
    user_id: null,
  };
};

/**
 * The subject kinds the caller may pick. A delegated administrator cannot
 * grant to a Team (10297): a Team crosses departments. Teams are offered only
 * to a caller who can list them.
 */
export const availableSubjectKinds = ({
  delegated,
  canReadTeams,
}: {
  delegated: boolean;
  canReadTeams: boolean;
}): RoleAssignmentSubjectKind[] => [
  "User",
  ...(!delegated && canReadTeams ? (["Team"] as const) : []),
  "OrgUnit",
];
