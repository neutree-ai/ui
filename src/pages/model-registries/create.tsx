import { NeutreeForm } from "@/foundation/components/NeutreeForm";
import { useModelRegistryForm } from "./use-model-registry-form";

export const ModelRegistriesCreate = () => {
  const { form, metadataFields, specFields } = useModelRegistryForm({
    action: "create",
  });

  return (
    <NeutreeForm {...form}>
      {metadataFields}
      {specFields}
    </NeutreeForm>
  );
};
