import { ResourceForm } from "@/foundation/components/ResourceForm";
import { useModelRegistryForm } from "./use-model-registry-form";

export const ModelRegistriesEdit = () => {
  const { form, metadataFields, specFields } = useModelRegistryForm({
    action: "edit",
  });

  return (
    <ResourceForm {...form}>
      {metadataFields}
      {specFields}
    </ResourceForm>
  );
};
