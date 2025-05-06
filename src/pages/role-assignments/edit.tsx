import { Form } from "@/components/theme";
import { useRoleAssignmentForm } from "./use-role-assignment-form";

export const RoleAssignmentsEdit = () => {
  const { form, metadataFields, specFields } = useRoleAssignmentForm({
    action: "edit",
  });

  return (
    <Form {...form}>
      {metadataFields}
      {specFields}
    </Form>
  );
};
