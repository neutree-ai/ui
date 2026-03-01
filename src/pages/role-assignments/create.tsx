import { useRoleAssignmentForm } from "@/domains/role-assignment/hooks/use-role-assignment-form";
import { ResourceForm } from "@/foundation/components/ResourceForm";

export const RoleAssignmentsCreate = () => {
  const { form, metadataFields, specFields } = useRoleAssignmentForm({
    action: "create",
  });

  return (
    <ResourceForm {...form}>
      {metadataFields}
      {specFields}
    </ResourceForm>
  );
};
