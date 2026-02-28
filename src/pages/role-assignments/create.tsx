import { NeutreeForm } from "@/components/business/NeutreeForm";
import { useRoleAssignmentForm } from "./use-role-assignment-form";

export const RoleAssignmentsCreate = () => {
  const { form, metadataFields, specFields } = useRoleAssignmentForm({
    action: "create",
  });

  return (
    <NeutreeForm {...form}>
      {metadataFields}
      {specFields}
    </NeutreeForm>
  );
};
