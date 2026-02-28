import { NeutreeForm } from "@/components/business/NeutreeForm";
import { useTranslation } from "@/lib/i18n";
import { useUserForm } from "./use-user-form";

export const UsersCreate = () => {
  const { t } = useTranslation();
  const { form, registerFields } = useUserForm({
    action: "create",
  });
  return (
    <NeutreeForm {...form} title={t("user_profiles.create")}>
      {registerFields}
    </NeutreeForm>
  );
};
