import { OrgUnitField } from "@/domains/organization/components/OrgUnitField";
import { TeamField } from "@/domains/organization/components/TeamField";
import { useRoleAssignmentForm } from "@/domains/role-assignment/hooks/use-role-assignment-form";
import { ServiceAccountField } from "@/domains/service-account/components/ServiceAccountField";
import { ResourceForm } from "@/foundation/components/ResourceForm";

export const RoleAssignmentsEdit = () => {
  const { form, metadataFields, specFields } = useRoleAssignmentForm({
    action: "edit",
    orgUnitField: <OrgUnitField />,
    teamField: <TeamField />,
    serviceAccountField: <ServiceAccountField />,
  });

  return (
    <ResourceForm {...form}>
      {metadataFields}
      {specFields}
    </ResourceForm>
  );
};
