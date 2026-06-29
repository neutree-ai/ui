import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAllApiKeyTraffic } from "@/domains/api-key/hooks/use-api-key-policy";
import { Link } from "@/foundation/components/Link";
import { useTranslation } from "@/foundation/lib/i18n";

// Format an average latency given in milliseconds as a human value: seconds when
// ≥1s (e.g. "8.65 s"), otherwise milliseconds ("420 ms").
const fmtLatency = (ms: number): string =>
  ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`;

// "过去 24 小时请求表现": request count, average latency and success rate over
// the last 24h, sourced from inference traces. Empty (—) when the key had no
// traffic in the window or the trace store is unavailable.
export const ApiKeyPerformanceCard = ({
  apiKeyId,
  workspace,
}: {
  apiKeyId: string;
  workspace: string;
}) => {
  const { t } = useTranslation();
  const traffic = useAllApiKeyTraffic(workspace);
  const stat = traffic.get(apiKeyId);
  const dash = <span className="text-muted-foreground">—</span>;

  const requests = stat?.requests ?? 0;
  const hasTraffic = requests > 0;

  return (
    <Card className="mt-4">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-xl font-semibold">
              {t("api_keys.performance.title")}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {t("api_keys.performance.subtitle")}
            </p>
          </div>
          <Link
            href={`/${encodeURIComponent(workspace)}/ai-traces?api_key_id=${encodeURIComponent(apiKeyId)}`}
            className="shrink-0 text-sm text-primary hover:underline"
          >
            {t("api_keys.performance.viewLogs")}
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">
              {t("api_keys.performance.requests")}
            </div>
            <div className="text-lg font-semibold tabular-nums">
              {requests.toLocaleString()}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">
              {t("api_keys.performance.avgLatency")}
            </div>
            <div className="text-lg font-semibold tabular-nums">
              {hasTraffic ? fmtLatency(stat?.avgDurationMs ?? 0) : dash}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">
              {t("api_keys.performance.successRate")}
            </div>
            <div className="text-lg font-semibold tabular-nums">
              {stat?.successRate != null ? (
                `${(stat.successRate * 100).toFixed(1)}%`
              ) : (
                dash
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
