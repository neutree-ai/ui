import { useModelRegistryForm } from "@/domains/model-registry/hooks/use-model-registry-form";
import { ResourceForm } from "@/foundation/components/ResourceForm";

export const ModelRegistriesCreate = () => {
  const { form, metadataFields, specFields } = useModelRegistryForm({
    action: "create",
  });

  return (
    <ResourceForm {...form}>
      {metadataFields}
      {specFields}
    </ResourceForm>
  );
};
