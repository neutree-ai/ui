import { CheckCircle2, Loader2, Plug, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TestConnectivityResult } from "@/domains/external-endpoint/hooks/use-test-connectivity";
import { useTranslation } from "@/foundation/lib/i18n";

type TestConnectivityButtonProps = {
  testing: boolean;
  result: TestConnectivityResult | null;
  onTest: () => void;
};

export default function TestConnectivityButton({
  testing,
  result,
  onTest,
}: TestConnectivityButtonProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onTest}
        disabled={testing}
      >
        {testing ? (
          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
        ) : (
          <Plug className="mr-1 h-4 w-4" />
        )}
        {testing
          ? t("external_endpoints.messages.testConnectivityTesting")
          : t("external_endpoints.messages.testConnectivity")}
      </Button>
      {result && !testing && (
        <span
          className={`inline-flex items-center gap-1 text-sm ${
            result.success ? "text-green-600" : "text-destructive"
          }`}
        >
          {result.success ? (
            <>
              <CheckCircle2 className="h-4 w-4" />
              {t("external_endpoints.messages.testConnectivitySuccess", {
                latencyMs: result.latency_ms ?? "?",
                modelCount: result.models?.length ?? 0,
              })}
            </>
          ) : (
            <>
              <XCircle className="h-4 w-4" />
              {t("external_endpoints.messages.testConnectivityFailed", {
                error: result.error ?? "Unknown error",
              })}
            </>
          )}
        </span>
      )}
    </div>
  );
}
