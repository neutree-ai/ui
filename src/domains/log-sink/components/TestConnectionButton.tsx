import { CheckCircle2, Loader2, Plug, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { TestConnectionResult } from "@/domains/log-sink/lib/test-connection";
import { useTranslation } from "@/foundation/lib/i18n";

type Props = {
  testing: boolean;
  result: TestConnectionResult | null;
  onTest: () => void;
};

/** The result is this run's only; it is not saved to the sink (data.md). */
export default function TestConnectionButton({
  testing,
  result,
  onTest,
}: Props) {
  const { t } = useTranslation();
  const failedText =
    result && !result.ok
      ? t("log_sinks.testConnection.failed", {
          message: result.message || t("common.errors.unknown"),
        })
      : "";

  return (
    <div className="flex flex-wrap items-start gap-3">
      <Button
        type="button"
        variant="outline"
        onClick={onTest}
        disabled={testing}
        data-testid="log-sink-test-connection"
      >
        {testing ? (
          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
        ) : (
          <Plug className="mr-1 h-4 w-4" />
        )}
        {testing
          ? t("log_sinks.testConnection.testing")
          : t("log_sinks.testConnection.button")}
      </Button>
      {result && !testing && result.ok && (
        <span
          data-testid="log-sink-test-result"
          className="inline-flex items-center gap-1 pt-2 text-sm text-[var(--nt-text-colorful-positive)]"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {t("log_sinks.testConnection.ok")}
        </span>
      )}
      {result && !testing && !result.ok && (
        // The message can carry the store's whole error body (e.g. a proxy's
        // HTML page): keep one line here and show all of it on hover.
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              data-testid="log-sink-test-result"
              className="inline-flex min-w-0 max-w-xl items-center gap-1 pt-2 text-sm text-[var(--nt-text-colorful-serious)]"
            >
              <XCircle className="h-4 w-4 shrink-0" />
              <span className="truncate">{failedText}</span>
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-lg">
            <pre className="max-h-96 max-w-lg overflow-auto whitespace-pre-wrap break-words">
              {failedText}
            </pre>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
