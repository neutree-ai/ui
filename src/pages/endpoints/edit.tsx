import { useEndpointForm } from "@/domains/endpoint/hooks/use-endpoint-form";
import { FormSectionStack } from "@/foundation/components/FormSectionStack";
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
      <FormSectionStack>
        {metadataFields}
        {templateFields}
        {resourceFields}
        {customizeFields}
      </FormSectionStack>
    </ResourceForm>
  );
};
