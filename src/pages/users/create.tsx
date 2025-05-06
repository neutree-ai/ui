import { Form } from "@/components/theme";
import { useUserForm } from "./use-user-form";

export const UsersCreate = () => {
  const { form, registerFields } = useUserForm({
    action: "create",
  });
  return (
    <Form {...form} title="Create User">
      {registerFields}
    </Form>
  );
};
