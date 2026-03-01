import { useRoleAssignmentForm } from "@/domains/role-assignment/hooks/use-role-assignment-form";
import { ResourceForm } from "@/foundation/components/ResourceForm";

export const RoleAssignmentsEdit = () => {
  const { form, metadataFields, specFields } = useRoleAssignmentForm({
    action: "edit",
  });

  return (
    <ResourceForm {...form}>
      {metadataFields}
      {specFields}
    </ResourceForm>
  );
};
