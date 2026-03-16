import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useExternalEndpointUsage } from "@/domains/external-endpoint/hooks/use-external-endpoint-usage";
import { formatTokens } from "@/foundation/lib/unit";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

type Props = {
  endpointName: string;
  workspace: string;
};

export default function ExternalEndpointMonitorPanel({
  endpointName,
  workspace,
}: Props) {
  const { t } = useTranslation();
  const { rows, summary, isLoading } = useExternalEndpointUsage(
    endpointName,
    workspace,
  );

  const metricCards = [
    {
      label: t("external_endpoints.stats.promptTokens"),
      value: formatTokens(summary.promptTokens) ?? "0",
    },
    {
      label: t("external_endpoints.stats.completionTokens"),
      value: formatTokens(summary.completionTokens) ?? "0",
    },
    {
      label: t("external_endpoints.stats.totalTokens"),
      value: formatTokens(summary.totalTokens) ?? "0",
    },
    {
      label: t("external_endpoints.stats.requests"),
      value: formatTokens(summary.totalRequests) ?? "0",
    },
  ];

  return (
    <div className="space-y-4 overflow-auto h-full">
      <div className="grid grid-cols-4 gap-4">
        {metricCards.map((card) => (
          <Card key={card.label}>
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-muted-foreground">{card.label}</p>
              {isLoading && rows.length === 0 ? (
                <Skeleton className="h-7 w-20 mt-1" />
              ) : (
                <p className="text-2xl font-semibold">{card.value}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="pt-4">
          {isLoading && rows.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              {t("loading")}
            </div>
          ) : rows.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {t("external_endpoints.monitor.noData")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("external_endpoints.monitor.date")}</TableHead>
                  <TableHead>
                    {t("external_endpoints.monitor.apiKey")}
                  </TableHead>
                  <TableHead>{t("external_endpoints.monitor.model")}</TableHead>
                  <TableHead className="text-right">
                    {t("external_endpoints.stats.promptTokens")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("external_endpoints.stats.completionTokens")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("external_endpoints.stats.requests")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell>{row.date}</TableCell>
                    <TableCell>{row.api_key_name}</TableCell>
                    <TableCell>
                      {row.model_name ?? (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.prompt_tokens != null ? (
                        formatTokens(row.prompt_tokens)
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.completion_tokens != null ? (
                        formatTokens(row.completion_tokens)
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatTokens(row.usage)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
