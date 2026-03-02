import { useExternalEndpointForm } from "@/domains/external-endpoint/hooks/use-external-endpoint-form";
import { ResourceForm } from "@/foundation/components/ResourceForm";

export const ExternalEndpointsEdit = () => {
  const { form, metadataFields, specFields } = useExternalEndpointForm({
    action: "edit",
  });
  return (
    <ResourceForm {...form}>
      {metadataFields}
      {specFields}
    </ResourceForm>
  );
};
