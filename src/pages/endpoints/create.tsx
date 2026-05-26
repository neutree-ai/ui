import { useEndpointForm } from "@/domains/endpoint/hooks/use-endpoint-form";
import { ResourceForm } from "@/foundation/components/ResourceForm";

export const EndpointsCreate = () => {
  const {
    form,
    metadataFields,
    templateFields,
    modelFields,
    engineFields,
    deploymentModeFields,
    resourceFields,
    roleFields,
    kvFields,
    customizeFields,
  } = useEndpointForm({
    action: "create",
  });

  return (
    <ResourceForm {...form}>
      {metadataFields}
      {templateFields}
      {modelFields}
      {engineFields}
      {deploymentModeFields}
      {resourceFields}
      {roleFields}
      {kvFields}
      {customizeFields}
    </ResourceForm>
  );
};
