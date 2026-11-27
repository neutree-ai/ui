import { Alert, AlertDescription } from "@/components/ui/alert";
import { useTranslation } from "@/foundation/lib/i18n";

/**
 * Shown for an upstream the gateway could not resolve. The models listed are
 * exactly the ones that stopped answering; when other upstreams still serve
 * all of its models, it says so instead. The error itself lives in the
 * upstream's status badge, which also offers copy-to-clipboard.
 */
export default function FailedUpstreamAlert({
  models,
  servedByOther,
}: {
  models: string[];
  servedByOther: boolean;
}) {
  const { t } = useTranslation();

  return (
    <Alert variant="destructive" className="mb-4">
      <AlertDescription>
        {t(
          servedByOther
            ? "external_endpoints.messages.upstreamUnavailableServedByOther"
            : "external_endpoints.messages.upstreamUnavailable",
        )}
        {models.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1 text-xs">
            <span>{t("external_endpoints.fields.unavailableModels")}</span>
            {models.map((model) => (
              <code
                key={model}
                className="rounded bg-background px-1.5 py-0.5 text-xs"
              >
                {model}
              </code>
            ))}
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}
