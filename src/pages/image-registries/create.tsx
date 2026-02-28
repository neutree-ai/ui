import { ResourceForm } from "@/foundation/components/ResourceForm";
import { useImageRegistryForm } from "./use-image-registry-form";

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
