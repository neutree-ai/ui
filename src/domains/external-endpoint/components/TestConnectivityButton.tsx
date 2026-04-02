import { useCustomMutation } from "@refinedev/core";
import { CheckCircle2, Loader2, Plug, XCircle } from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/foundation/lib/i18n";

type TestConnectivityResult = {
  success: boolean;
  latency_ms?: number;
  models?: string[];
  error?: string;
};

type TestConnectivityButtonProps = {
  getValues: () => { url: string; credential: string };
  onModelsReceived?: (models: string[]) => void;
};

export default function TestConnectivityButton({
  getValues,
  onModelsReceived,
}: TestConnectivityButtonProps) {
  const { t } = useTranslation();
  const { mutateAsync } = useCustomMutation();
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestConnectivityResult | null>(null);

  const handleTest = useCallback(async () => {
    const { url, credential } = getValues();
    setTesting(true);
    setResult(null);
    try {
      const res = await mutateAsync({
        url: "/external_endpoints/test_connectivity",
        method: "post",
        values: {
          upstream: { url },
          auth: { type: "bearer", credential },
        },
        successNotification: false,
        errorNotification: false,
      });
      const data = res.data as TestConnectivityResult;
      setResult(data);
      if (data.success && data.models?.length && onModelsReceived) {
        onModelsReceived(data.models);
      }
    } catch (err) {
      setResult({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setTesting(false);
    }
  }, [getValues, mutateAsync, onModelsReceived]);

  return (
    <div className="flex items-center gap-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleTest}
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
