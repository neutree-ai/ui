import { useLogSinkForm } from "@/domains/log-sink/hooks/use-log-sink-form";
import { useTranslation } from "@/foundation/lib/i18n";
import { ResourceForm } from "@/foundation/scene/ResourceForm";

export const LogSinksCreate = () => {
  const { t } = useTranslation();
  const { form, metadataFields, specFields } = useLogSinkForm({
    action: "create",
  });
  return (
    <ResourceForm {...form} title={t("log_sinks.create.title")}>
      {metadataFields}
      {specFields}
    </ResourceForm>
  );
};
