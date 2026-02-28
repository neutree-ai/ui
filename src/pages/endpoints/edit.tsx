import { ResourceForm } from "@/foundation/components/ResourceForm";
import { useEndpointForm } from "./use-endpoint-form";

export const EndpointsEdit = () => {
  const {
    form,
    metadataFields,
    templateFields,
    resourceFields,
    customizeFields,
  } = useEndpointForm({
    action: "edit",
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
