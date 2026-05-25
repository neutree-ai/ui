import { useEndpointForm } from "@/domains/endpoint/hooks/use-endpoint-form";
import { ResourceForm } from "@/foundation/components/ResourceForm";

export const EndpointsCreate = () => {
  const {
    form,
    metadataFields,
    templateFields,
    recipeFields,
    resourceFields,
    customizeFields,
  } = useEndpointForm({
    action: "create",
  });

  return (
    <ResourceForm {...form}>
      {metadataFields}
      {templateFields}
      {recipeFields}
      {resourceFields}
      {customizeFields}
    </ResourceForm>
  );
};
