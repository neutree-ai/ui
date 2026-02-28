import { NeutreeForm } from "@/components/business/NeutreeForm";
import { useTranslation } from "@/lib/i18n";
import { useUserForm } from "./use-user-form";

export const UsersEdit = () => {
  const { t } = useTranslation();
  const { form, metadataFields, specFields } = useUserForm({
    action: "edit",
  });
  return (
    <NeutreeForm {...form} title={t("user_profiles.edit")}>
      {metadataFields}
      {specFields}
    </NeutreeForm>
  );
};
