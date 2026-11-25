import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { identitySourcePhases } from "@/domains/identity-source/lib/phases";
import type { IdentitySourceStatus as IdentitySourceStatusType } from "@/domains/identity-source/types";
import { useTranslation } from "@/foundation/lib/i18n";
import { cn } from "@/foundation/lib/utils";
import { phaseTone } from "@/foundation/role/phases";
import Timestamp from "@/foundation/role/Timestamp";

/**
 * The phase the controller last wrote, with the last connection test (when,
 * whether it worked, what it said) on hover. The controller retests on every
 * change and every few minutes; there is no "test now".
 */
export function IdentitySourceStatus({
  status,
}: {
  status?: IdentitySourceStatusType | null;
}) {
  const { t } = useTranslation();
  const phase = status?.phase;

  if (!phase) {
    return <span data-testid="identity-source-status">-</span>;
  }

  const test = status?.last_connection_test;
  const errorMessage = status?.error_message?.trim();
  const testMessage = test?.message?.trim();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          data-testid="identity-source-status"
          className={cn(
            "inline-flex whitespace-nowrap rounded-lg px-2 py-1 text-xs font-semibold",
            phaseTone(identitySourcePhases, phase),
          )}
        >
          {t(identitySourcePhases.label(phase), phase)}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-lg">
        <div className="flex flex-col gap-1">
          {errorMessage && (
            <pre className="max-h-96 max-w-lg overflow-auto whitespace-pre-wrap break-words">
              {errorMessage}
            </pre>
          )}
          {test?.time ? (
            <div>
              {t(
                test.ok
                  ? "identity_sources.status.lastTestOk"
                  : "identity_sources.status.lastTestFailed",
              )}{" "}
              <Timestamp timestamp={test.time} />
            </div>
          ) : (
            <div>{t("identity_sources.status.notTested")}</div>
          )}
          {testMessage && testMessage !== errorMessage && (
            <div className="whitespace-pre-wrap break-words">{testMessage}</div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
