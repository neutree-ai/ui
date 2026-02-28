import { ResourceForm } from "@/foundation/components/ResourceForm";
import { useRoleAssignmentForm } from "./use-role-assignment-form";

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
