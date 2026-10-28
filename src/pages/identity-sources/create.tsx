import { useIdentitySourceForm } from "@/domains/identity-source/hooks/use-identity-source-form";
import { ResourceForm } from "@/foundation/components/ResourceForm";
import { useTranslation } from "@/foundation/lib/i18n";

export const IdentitySourcesCreate = () => {
  const { t } = useTranslation();
  const { form, metadataFields, specFields, adminNote } = useIdentitySourceForm(
    { action: "create" },
  );
  return (
    <ResourceForm {...form} title={t("identity_sources.create.title")}>
      {metadataFields}
      {specFields}
      {adminNote}
    </ResourceForm>
  );
};
