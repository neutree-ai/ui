import { NeutreeForm } from "@/foundation/components/NeutreeForm";
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
    <NeutreeForm {...form}>
      {metadataFields}
      {templateFields}
      {resourceFields}
      {customizeFields}
    </NeutreeForm>
  );
};
