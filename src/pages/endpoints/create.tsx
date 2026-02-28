import { ResourceForm } from "@/foundation/components/ResourceForm";
import { useEndpointForm } from "./use-endpoint-form";

export const EndpointsCreate = () => {
  const {
    form,
    metadataFields,
    templateFields,
    resourceFields,
    customizeFields,
  } = useEndpointForm({
    action: "create",
  });

  return (
    <ResourceForm {...form}>
      {metadataFields}
      {templateFields}
      {resourceFields}
      {customizeFields}
    </ResourceForm>
  );
};
