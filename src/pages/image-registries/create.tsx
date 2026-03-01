import { useImageRegistryForm } from "@/domains/image-registry/hooks/use-image-registry-form";
import { ResourceForm } from "@/foundation/components/ResourceForm";

export const ImageRegistriesCreate = () => {
  const { form, metadataFields, specFields } = useImageRegistryForm({
    action: "create",
  });
  return (
    <ResourceForm {...form}>
      {metadataFields}
      {specFields}
    </ResourceForm>
  );
};
