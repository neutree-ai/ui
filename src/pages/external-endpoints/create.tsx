import { useExternalEndpointForm } from "@/domains/external-endpoint/hooks/use-external-endpoint-form";
import { ResourceForm } from "@/foundation/components/ResourceForm";
import { useTranslation } from "@/foundation/lib/i18n";

export const ExternalEndpointsCreate = () => {
  const { t } = useTranslation();
  const { form, metadataFields, specFields, submitBlocked } =
    useExternalEndpointForm({
      action: "create",
    });
  return (
    <ResourceForm
      {...form}
      submitBlocked={submitBlocked}
      title={t("external_endpoints.create")}
    >
      {metadataFields}
      {specFields}
    </ResourceForm>
  );
};
