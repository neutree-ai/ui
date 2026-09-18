import { useSearchParams } from "react-router-dom";
import { useExternalEndpointForm } from "@/domains/external-endpoint/hooks/use-external-endpoint-form";
import { ResourceForm } from "@/foundation/components/ResourceForm";

export const ExternalEndpointsEdit = () => {
  const [searchParams] = useSearchParams();
  const { form, metadataFields, specFields } = useExternalEndpointForm({
    action: "edit",
    focusModel: searchParams.get("model") ?? undefined,
  });
  return (
    <ResourceForm {...form}>
      {metadataFields}
      {specFields}
    </ResourceForm>
  );
};
