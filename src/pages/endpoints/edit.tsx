import { useEndpointForm } from "@/domains/endpoint/hooks/use-endpoint-form";
import { ResourceForm } from "@/foundation/components/ResourceForm";
import { useTranslation } from "@/foundation/lib/i18n";

export const EndpointsEdit = () => {
  const { t } = useTranslation();
  const {
    form,
    submitBlocked,
    metadataFields,
    templateFields,
    resourceFields,
    customizeFields,
  } = useEndpointForm({
    action: "edit",
  });

  return (
    <ResourceForm
      {...form}
      submitBlocked={submitBlocked}
      title={t("endpoints.edit", "Edit Endpoint")}
    >
      {metadataFields}
      {templateFields}
      {resourceFields}
      {customizeFields}
    </ResourceForm>
  );
};
