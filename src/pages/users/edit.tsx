import { useUserForm } from "@/domains/user/hooks/use-user-form";
import { useTranslation } from "@/foundation/lib/i18n";
import { ResourceForm } from "@/foundation/scene/ResourceForm";

export const UsersEdit = () => {
  const { t } = useTranslation();
  const { form, metadataFields, specFields } = useUserForm({
    action: "edit",
  });
  return (
    <ResourceForm {...form} title={t("user_profiles.edit")}>
      {metadataFields}
      {specFields}
    </ResourceForm>
  );
};
