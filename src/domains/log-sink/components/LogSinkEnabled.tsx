import { useTranslation } from "@/foundation/lib/i18n";

export default function LogSinkEnabled({
  enabled,
}: {
  enabled: boolean | undefined;
}) {
  const { t } = useTranslation();
  // Stored true when omitted (data.md, spec.enabled).
  return (
    <>
      {enabled === false ? t("log_sinks.values.no") : t("log_sinks.values.yes")}
    </>
  );
}
