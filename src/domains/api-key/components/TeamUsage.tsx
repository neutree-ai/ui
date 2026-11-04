import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useGroupUsage } from "@/domains/api-key/hooks/use-group-usage";
import {
  type DateRange,
  DateRangePicker,
  trailingRange,
} from "@/foundation/components/DateRangePicker";
import { EmptyState } from "@/foundation/components/EmptyState";
import { Loader } from "@/foundation/components/Loader";
import { ShowPage } from "@/foundation/components/ShowPage";
import { ALL_WORKSPACES } from "@/foundation/hooks/use-workspace";
import { formatTokenQuota } from "@/foundation/lib/token-quota";

type ModelTotal = {
  key: string;
  model: string;
  endpoint: string;
  workspace: string;
  requests: number;
  tokens: number;
};

/**
 * Usage of one Team in every workspace: its members' personal keys and its
 * Team keys, as get_usage_by_group records it.
 */
export function TeamUsage({ teamName }: { teamName: string }) {
  const { t } = useTranslation();
  const [range, setRange] = useState<DateRange>(() => trailingRange(30));
  const { usageData, isLoading, error } = useGroupUsage(
    ALL_WORKSPACES,
    range.start,
    range.end,
    "Team",
    { team: teamName },
  );

  const { requests, tokens, models } = useMemo(() => {
    const byModel = new Map<string, ModelTotal>();
    let requests = 0;
    let tokens = 0;
    for (const row of usageData) {
      if (row.name !== teamName) continue;
      requests += Number(row.requests) || 0;
      tokens += Number(row.usage) || 0;
      const model = row.model_name ?? "-";
      const key = [row.workspace, row.endpoint_name, model].join("\0");
      const total = byModel.get(key) ?? {
        key,
        model,
        endpoint: row.endpoint_name,
        workspace: row.workspace,
        requests: 0,
        tokens: 0,
      };
      total.requests += Number(row.requests) || 0;
      total.tokens += Number(row.usage) || 0;
      byModel.set(key, total);
    }
    return {
      requests,
      tokens,
      models: [...byModel.values()].sort((a, b) => b.tokens - a.tokens),
    };
  }, [usageData, teamName]);

  return (
    <div className="space-y-3" data-testid="team-usage">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {t("api_keys.team.usageHint")}
        </p>
        <DateRangePicker className="h-8" value={range} onChange={setRange} />
      </div>
      {isLoading && !usageData.length ? (
        <div className="flex justify-center py-6">
          <Loader className="w-10 text-muted-foreground" />
        </div>
      ) : error ? (
        <EmptyState variant="inline" className="text-destructive">
          {t("api_keys.team.usageFailed")}
        </EmptyState>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <ShowPage.SummaryItem
              label={t("api_keys.team.totalTokens")}
              value={formatTokenQuota(tokens)}
            />
            <ShowPage.SummaryItem
              label={t("api_keys.team.totalRequests")}
              value={requests.toLocaleString()}
            />
          </div>
          {models.length ? (
            <Table data-testid="team-usage-models">
              <TableHeader>
                <TableRow>
                  <TableHead>{t("api_keys.fields.model")}</TableHead>
                  <TableHead>{t("api_keys.fields.endpoint")}</TableHead>
                  <TableHead>{t("api_keys.fields.workspace")}</TableHead>
                  <TableHead className="text-right">
                    {t("api_keys.team.requests")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("api_keys.fields.usage")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {models.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell>{row.model}</TableCell>
                    <TableCell>{row.endpoint}</TableCell>
                    <TableCell>{row.workspace}</TableCell>
                    <TableCell className="text-right">
                      {row.requests.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatTokenQuota(row.tokens)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState variant="inline" data-testid="team-usage-empty">
              {t("api_keys.team.usageEmpty")}
            </EmptyState>
          )}
        </>
      )}
    </div>
  );
}
