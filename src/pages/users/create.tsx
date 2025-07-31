import { Form } from "@/components/theme";
import { useTranslation } from "@/lib/i18n";
import { useUserForm } from "./use-user-form";

export const UsersCreate = () => {
  const { t } = useTranslation();
  const { form, registerFields } = useUserForm({
    action: "create",
  });
  return (
    <Form {...form} title={t("user_profiles.create")}>
      {registerFields}
    </Form>
  );
};
