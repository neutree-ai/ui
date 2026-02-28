import { ResourceForm } from "@/foundation/components/ResourceForm";
import { useModelRegistryForm } from "./use-model-registry-form";

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
