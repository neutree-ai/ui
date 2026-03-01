import { useUserForm } from "@/domains/user/hooks/use-user-form";
import { ResourceForm } from "@/foundation/components/ResourceForm";
import { useTranslation } from "@/foundation/lib/i18n";

export const UsersCreate = () => {
  const { t } = useTranslation();
  const { form, registerFields } = useUserForm({
    action: "create",
  });
  return (
    <ResourceForm {...form} title={t("user_profiles.create")}>
      {registerFields}
    </ResourceForm>
  );
};
