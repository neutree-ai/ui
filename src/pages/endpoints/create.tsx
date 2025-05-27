import { Form } from "@/components/theme";
import { useEndpointForm } from "./use-endpoint-form";

export const EndpointsCreate = () => {
  const { form, metadataFields, templateFields, customizeFields } =
    useEndpointForm({
      action: "create",
    });

  return (
    <Form {...form}>
      {metadataFields}
      {templateFields}
      {customizeFields}
    </Form>
  );
};
