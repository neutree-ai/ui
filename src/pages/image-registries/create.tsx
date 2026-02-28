import { NeutreeForm } from "@/components/business/NeutreeForm";
import { useImageRegistryForm } from "./use-image-registry-form";

export const ImageRegistriesCreate = () => {
  const { form, metadataFields, specFields } = useImageRegistryForm({
    action: "create",
  });
  return (
    <NeutreeForm {...form}>
      {metadataFields}
      {specFields}
    </NeutreeForm>
  );
};
