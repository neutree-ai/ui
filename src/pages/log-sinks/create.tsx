import { useLogSinkForm } from "@/domains/log-sink/hooks/use-log-sink-form";
import { ResourceForm } from "@/foundation/components/ResourceForm";
import { useTranslation } from "@/foundation/lib/i18n";

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
