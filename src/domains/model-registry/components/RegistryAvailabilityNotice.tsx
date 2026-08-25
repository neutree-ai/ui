import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { LoadingIcon } from "@/components/ui/loading";
import { useRetryRegistryConnection } from "@/domains/model-registry/hooks/use-retry-registry-connection";
import type { ModelRegistry } from "@/domains/model-registry/types";
import { formatTimestamp } from "@/foundation/components/Timestamp";
import { useTranslation } from "@/foundation/lib/i18n";
import {
  registryIsDisabled,
  registryIsUnreachable,
} from "@/foundation/lib/model-registry-availability";

/**
 * Why a registry is not answering, and the one control that does something
 * about it.
 *
 * Deliberately a warning rather than an error. A registry being out of reach is
 * a normal condition — an air-gapped site has a public registry it cannot use,
 * permanently, by design — and painting that red on every page load teaches
 * people to ignore the colour that is supposed to mean something is broken. It
 * states the reason the server gave and when the server last looked, and gets
 * out of the way.
 *
 * `last_checked_at` is the time shown, not `last_transition_time`: the question
 * being answered is "is this current?", and the transition time answers a
 * different one — a registry that broke on Monday reports Monday all week.
 */

type Props = {
  workspace: string;
  registry: ModelRegistry;
};

export const RegistryAvailabilityNotice = ({ workspace, registry }: Props) => {
  const { t } = useTranslation();
  const retry = useRetryRegistryConnection();

  if (registryIsDisabled(registry)) {
    return (
      <Alert data-testid="registry-disabled-notice">
        <AlertTitle>{t("model_registries.availability.disabled")}</AlertTitle>
        <AlertDescription>
          {t("model_registries.availability.disabledHint")}
        </AlertDescription>
      </Alert>
    );
  }

  if (!registryIsUnreachable(registry)) {
    return null;
  }

  const lastChecked = registry.status?.last_checked_at;

  const onRetry = () => {
    retry.mutate(
      { workspace, registry: registry.metadata.name },
      {
        // The notice disappears when the registry comes back, so the outcome has
        // to be said out loud — otherwise a successful retry looks like the
        // panel having crashed. A failed check reports the reason the check
        // itself gave; the panel below refreshes with the registry's own.
        onSuccess: (result) => {
          if (result.phase === "Failed") {
            toast.error(t("model_registries.availability.retryStillFailing"), {
              description: result.error_message,
            });
            return;
          }

          toast.success(t("model_registries.availability.retrySucceeded"));
        },
        onError: (error) => {
          toast.error(t("model_registries.availability.retryNotRun"), {
            description: error.message,
          });
        },
      },
    );
  };

  return (
    <Alert variant="warning" data-testid="registry-unreachable-notice">
      <AlertTitle>{t("model_registries.availability.unreachable")}</AlertTitle>
      <AlertDescription>
        <div className="space-y-2">
          {registry.status?.error_message && (
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words text-xs">
              {registry.status.error_message}
            </pre>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs">
              {lastChecked
                ? t("model_registries.availability.lastChecked", {
                    time: formatTimestamp(lastChecked),
                  })
                : t("model_registries.availability.lastCheckedUnknown")}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={retry.isLoading}
              onClick={onRetry}
              data-testid="registry-retry-connection"
            >
              {retry.isLoading && <LoadingIcon className="mr-2 h-3 w-3" />}
              {t("model_registries.availability.retry")}
            </Button>
          </div>
          <p className="text-xs">
            {t("model_registries.availability.retryHint")}
          </p>
        </div>
      </AlertDescription>
    </Alert>
  );
};
