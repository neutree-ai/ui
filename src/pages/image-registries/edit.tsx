import { NeutreeForm } from "@/foundation/components/NeutreeForm";
import { useImageRegistryForm } from "./use-image-registry-form";

export const ImageRegistriesEdit = () => {
  const { form, metadataFields, specFields } = useImageRegistryForm({
    action: "edit",
  });

  return (
    <NeutreeForm {...form}>
      {metadataFields}
      {specFields}
    </NeutreeForm>
  );
};
