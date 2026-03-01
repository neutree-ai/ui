import { useImageRegistryForm } from "@/domains/image-registry/hooks/use-image-registry-form";
import { ResourceForm } from "@/foundation/components/ResourceForm";

export const ImageRegistriesEdit = () => {
  const { form, metadataFields, specFields } = useImageRegistryForm({
    action: "edit",
  });

  return (
    <ResourceForm {...form}>
      {metadataFields}
      {specFields}
    </ResourceForm>
  );
};
