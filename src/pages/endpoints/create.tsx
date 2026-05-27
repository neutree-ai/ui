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
    replicaFields,
    resourceFields,
    roleFields,
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
      {replicaFields}
      {deploymentModeFields}
      {resourceFields}
      {roleFields}
      {customizeFields}
    </ResourceForm>
  );
};
