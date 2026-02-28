import { NeutreeForm } from "@/foundation/components/NeutreeForm";
import { useModelRegistryForm } from "./use-model-registry-form";

export const ModelRegistriesEdit = () => {
  const { form, metadataFields, specFields } = useModelRegistryForm({
    action: "edit",
  });

  return (
    <NeutreeForm {...form}>
      {metadataFields}
      {specFields}
    </NeutreeForm>
  );
};
