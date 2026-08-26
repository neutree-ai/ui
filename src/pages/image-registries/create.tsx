import { useImageRegistryForm } from "@/domains/image-registry/hooks/use-image-registry-form";
import { ResourceForm } from "@/foundation/components/ResourceForm";
import { useTranslation } from "@/foundation/lib/i18n";

export const ImageRegistriesCreate = () => {
  const { t } = useTranslation();
  const { form, metadataFields, specFields } = useImageRegistryForm({
    action: "create",
  });
  return (
    <ResourceForm {...form} title={t("image_registries.create.title")}>
      {metadataFields}
      {specFields}
    </ResourceForm>
  );
};
