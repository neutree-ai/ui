import { NeutreeForm } from "@/foundation/components/NeutreeForm";
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
    <NeutreeForm {...form}>
      {metadataFields}
      {templateFields}
      {resourceFields}
      {customizeFields}
    </NeutreeForm>
  );
};
