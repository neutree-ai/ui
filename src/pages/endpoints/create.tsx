import { useEndpointForm } from "@/domains/endpoint/hooks/use-endpoint-form";
import { FormSectionStack } from "@/foundation/components/FormSectionStack";
import { ResourceForm } from "@/foundation/components/ResourceForm";
import { useTranslation } from "@/foundation/lib/i18n";

export const EndpointsCreate = () => {
  const { t } = useTranslation();
  const {
    form,
    submitBlocked,
    metadataFields,
    advancedToggle,
    templateFields,
    recipeFields,
    weightFields,
    resourceFields,
    customizeFields,
  } = useEndpointForm({
    action: "create",
  });

  return (
    <ResourceForm
      {...form}
      submitBlocked={submitBlocked}
      title={t("endpoints.create", "Create Endpoint")}
    >
      <FormSectionStack>
        {metadataFields}
        {advancedToggle}
        {templateFields}
        {recipeFields}
        {weightFields}
        {resourceFields}
        {customizeFields}
      </FormSectionStack>
    </ResourceForm>
  );
};
