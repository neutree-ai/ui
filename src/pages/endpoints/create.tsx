import { Form } from "@/components/theme";
import { useEndpointForm } from "./use-endpoint-form";

export const EndpointsCreate = () => {
  const {
    form,
    metadataFields,
    modelFields,
    resourceFields,
    engineFields,
    replicaFields,
    advancedFields,
  } = useEndpointForm({
    action: "create",
  });

  return (
    <Form {...form}>
      {metadataFields}
      {modelFields}
      {resourceFields}
      {engineFields}
      {replicaFields}
      {advancedFields}
    </Form>
  );
};
