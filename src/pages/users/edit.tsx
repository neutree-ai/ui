import { Form } from "@/components/theme";
import { useTranslation } from "@/lib/i18n";
import { useUserForm } from "./use-user-form";

export const UsersEdit = () => {
  const { t } = useTranslation();
  const { form, metadataFields, specFields } = useUserForm({
    action: "edit",
  });
  return (
    <Form {...form} title={t("user_profiles.edit")}>
      {metadataFields}
      {specFields}
    </Form>
  );
};
