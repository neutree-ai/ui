import { ResourceForm } from "@/foundation/components/ResourceForm";
import { useImageRegistryForm } from "./use-image-registry-form";

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
