import { Form } from "@/components/theme";
import { useEndpointForm } from "./use-endpoint-form";

export const EndpointsEdit = () => {
  const { form, metadataFields, templateFields, customizeFields } =
    useEndpointForm({
      action: "edit",
    });

  return (
    <Form {...form}>
      {metadataFields}
      {templateFields}
      {customizeFields}
    </Form>
  );
};
