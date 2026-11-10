import { OrgUnitField } from "@/domains/organization/components/OrgUnitField";
import { TeamField } from "@/domains/organization/components/TeamField";
import { useRoleAssignmentForm } from "@/domains/role-assignment/hooks/use-role-assignment-form";
import { ResourceForm } from "@/foundation/components/ResourceForm";

export const RoleAssignmentsCreate = () => {
  const { form, metadataFields, specFields } = useRoleAssignmentForm({
    action: "create",
    orgUnitField: <OrgUnitField />,
    teamField: <TeamField />,
  });

  return (
    <ResourceForm {...form}>
      {metadataFields}
      {specFields}
    </ResourceForm>
  );
};
