import { ResourceForm } from "@/foundation/components/ResourceForm";
import { useTranslation } from "@/foundation/lib/i18n";
import { useUserForm } from "./use-user-form";

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
