import { ResourceForm } from "@/foundation/components/ResourceForm";
import { useRoleAssignmentForm } from "./use-role-assignment-form";

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
