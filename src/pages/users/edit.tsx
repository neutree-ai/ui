import { Form } from "@/components/theme";
import { useUserForm } from "./use-user-form";

export const UsersEdit = () => {
  const { form, metadataFields, specFields } = useUserForm({
    action: "edit",
  });
  return (
    <Form {...form} title="Edit User">
      {metadataFields}
      {specFields}
    </Form>
  );
};
