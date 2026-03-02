import { useExternalEndpointForm } from "@/domains/external-endpoint/hooks/use-external-endpoint-form";
import { ResourceForm } from "@/foundation/components/ResourceForm";

export const ExternalEndpointsCreate = () => {
  const { form, metadataFields, specFields } = useExternalEndpointForm({
    action: "create",
  });
  return (
    <ResourceForm {...form}>
      {metadataFields}
      {specFields}
    </ResourceForm>
  );
};
