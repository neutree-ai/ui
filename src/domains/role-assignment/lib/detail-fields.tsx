import { RoleAssignmentScopeLabel } from "@/domains/role-assignment/components/RoleAssignmentScopeLabel";
import {
  type GroupRenderers,
  RoleAssignmentSubjectLabel,
} from "@/domains/role-assignment/components/RoleAssignmentSubjectLabel";
import type { RoleAssignment } from "@/domains/role-assignment/types";
import { type DetailField, field } from "@/foundation/scene/detail-field";
import { ShowButton } from "@/foundation/scene/ShowButton";

type Fields = DetailField<RoleAssignment>[];

/** Header and policy-section fields; the page supplies the group renderers. */
export const roleAssignmentFields = (groups: GroupRenderers) => {
  const subject: DetailField<RoleAssignment> = field(
    "role_assignments.fields.subject",
    {
      render: (assignment) => (
        <RoleAssignmentSubjectLabel spec={assignment.spec} {...groups} />
      ),
    },
  );
  const header: Fields = [
    field("role_assignments.fields.scope", {
      render: (assignment) => (
        <RoleAssignmentScopeLabel spec={assignment.spec} {...groups} />
      ),
    }),
    field("common.fields.role", (assignment) => assignment.spec.role),
    subject,
  ];
  const policy: Fields = [
    field("common.fields.role", {
      render: (assignment) => (
        <ShowButton
          recordItemId={assignment.spec.role}
          meta={{}}
          variant="link"
          resource="roles"
        >
          {assignment.spec.role}
        </ShowButton>
      ),
    }),
    subject,
  ];
  return { header, policy };
};
