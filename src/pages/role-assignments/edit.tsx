import { NeutreeForm } from "@/foundation/components/NeutreeForm";
import { useRoleAssignmentForm } from "./use-role-assignment-form";

export const RoleAssignmentsEdit = () => {
  const { form, metadataFields, specFields } = useRoleAssignmentForm({
    action: "edit",
  });

  return (
    <NeutreeForm {...form}>
      {metadataFields}
      {specFields}
    </NeutreeForm>
  );
};
