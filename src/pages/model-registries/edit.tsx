import { useModelRegistryForm } from "@/domains/model-registry/hooks/use-model-registry-form";
import { ResourceForm } from "@/foundation/components/ResourceForm";

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
