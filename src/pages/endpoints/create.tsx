import { useEndpointForm } from "@/domains/endpoint/hooks/use-endpoint-form";
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
      {metadataFields}
      {advancedToggle}
      {templateFields}
      {recipeFields}
      {resourceFields}
      {customizeFields}
    </ResourceForm>
  );
};
