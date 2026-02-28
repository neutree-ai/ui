import { NeutreeForm } from "@/components/business/NeutreeForm";
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
