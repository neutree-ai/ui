import { Form } from "@/components/theme";
import { useRoleForm } from "./use-role-form";

export const RolesCreate = () => {
  const { form, metadataFields, specFields } = useRoleForm({
    action: "create",
  });

  return (
    <Form {...form}>
      {metadataFields}
      {specFields}
    </Form>
  );
};
