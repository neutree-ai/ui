import { Form } from "@/components/theme";
import { useImageRegistryForm } from "./use-image-registry-form";

export const ImageRegistriesCreate = () => {
  const { form, metadataFields, specFields } = useImageRegistryForm({
    action: "create",
  });
  return (
    <Form {...form}>
      {metadataFields}
      {specFields}
    </Form>
  );
};
