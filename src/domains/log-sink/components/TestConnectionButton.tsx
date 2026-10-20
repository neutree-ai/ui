import { CheckCircle2, Loader2, Plug, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
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
      {result && !testing && (
        <span
          data-testid="log-sink-test-result"
          className={`inline-flex min-w-0 items-start gap-1 pt-2 text-sm ${
            result.ok
              ? "text-[var(--nt-text-colorful-positive)]"
              : "text-[var(--nt-text-colorful-serious)]"
          }`}
        >
          {result.ok ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span className="whitespace-pre-wrap break-words">
            {result.ok
              ? t("log_sinks.testConnection.ok")
              : t("log_sinks.testConnection.failed", {
                  message: result.message || t("common.errors.unknown"),
                })}
          </span>
        </span>
      )}
    </div>
  );
}
