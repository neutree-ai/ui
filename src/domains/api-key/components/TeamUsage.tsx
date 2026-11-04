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
  summarizeUsage,
  type UsageTotal,
  usageByApplication,
} from "@/domains/api-key/lib/usage-summary";
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

function TotalsTable({
  rows,
  firstColumn,
  detailed,
  testId,
}: {
  rows: UsageTotal[];
  firstColumn: string;
  detailed: boolean;
  testId: string;
}) {
  const { t } = useTranslation();
  return (
    <Table data-testid={testId}>
      <TableHeader>
        <TableRow>
          <TableHead>{firstColumn}</TableHead>
          {detailed && <TableHead>{t("api_keys.fields.endpoint")}</TableHead>}
          {detailed && <TableHead>{t("api_keys.fields.workspace")}</TableHead>}
          <TableHead className="text-right">
            {t("api_keys.team.requests")}
          </TableHead>
          <TableHead className="text-right">
            {t("api_keys.fields.usage")}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.key}>
            <TableCell>{row.label}</TableCell>
            {detailed && <TableCell>{row.endpoint}</TableCell>}
            {detailed && <TableCell>{row.workspace}</TableCell>}
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
  );
}

function Totals({ requests, tokens }: { requests: number; tokens: number }) {
  const { t } = useTranslation();
  return (
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
  );
}

/**
 * Usage of one Team in every workspace: its members' personal keys and its
 * applications' keys, then split by application.
 */
export function TeamUsage({ teamName }: { teamName: string }) {
  const { t } = useTranslation();
  const [range, setRange] = useState<DateRange>(() => trailingRange(30));
  const team = useGroupUsage(ALL_WORKSPACES, range.start, range.end, "Team", {
    team: teamName,
  });
  const apps = useGroupUsage(
    ALL_WORKSPACES,
    range.start,
    range.end,
    "ServiceAccount",
    { team: teamName },
  );
  const summary = useMemo(
    () => summarizeUsage(team.usageData, teamName),
    [team.usageData, teamName],
  );
  const byApp = useMemo(
    () => usageByApplication(apps.usageData),
    [apps.usageData],
  );

  return (
    <div className="space-y-3" data-testid="team-usage">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {t("api_keys.team.usageHint")}
        </p>
        <DateRangePicker className="h-8" value={range} onChange={setRange} />
      </div>
      {team.isLoading && !team.usageData.length ? (
        <div className="flex justify-center py-6">
          <Loader className="w-10 text-muted-foreground" />
        </div>
      ) : team.error ? (
        <EmptyState variant="inline" className="text-destructive">
          {t("api_keys.team.usageFailed")}
        </EmptyState>
      ) : (
        <>
          <Totals requests={summary.requests} tokens={summary.tokens} />
          {summary.models.length ? (
            <TotalsTable
              rows={summary.models}
              firstColumn={t("api_keys.fields.model")}
              detailed
              testId="team-usage-models"
            />
          ) : (
            <EmptyState variant="inline" data-testid="team-usage-empty">
              {t("api_keys.team.usageEmpty")}
            </EmptyState>
          )}
        </>
      )}
      <ShowPage.Section
        title={t("api_keys.team.byApplication")}
        description={t("api_keys.team.byApplicationHint")}
        data-testid="team-usage-applications"
      >
        {apps.error ? (
          <EmptyState variant="inline" className="text-destructive">
            {t("api_keys.team.usageFailed")}
          </EmptyState>
        ) : byApp.length ? (
          <TotalsTable
            rows={byApp}
            firstColumn={t("api_keys.team.application")}
            detailed={false}
            testId="team-usage-by-application"
          />
        ) : (
          <EmptyState variant="inline">
            {t("api_keys.team.usageEmpty")}
          </EmptyState>
        )}
      </ShowPage.Section>
    </div>
  );
}

/** Usage of one application in every workspace, by model. */
export function ServiceAccountUsage({
  teamName,
  serviceAccountId,
}: {
  teamName: string;
  serviceAccountId: string;
}) {
  const { t } = useTranslation();
  const [range, setRange] = useState<DateRange>(() => trailingRange(30));
  const { usageData, isLoading, error } = useGroupUsage(
    ALL_WORKSPACES,
    range.start,
    range.end,
    "ServiceAccount",
    { team: teamName },
  );
  const summary = useMemo(
    () => summarizeUsage(usageData, serviceAccountId),
    [usageData, serviceAccountId],
  );

  return (
    <ShowPage.Section
      title={t("api_keys.serviceAccount.usageTitle")}
      data-testid="sa-usage"
      contentClassName="space-y-3"
      actions={
        <DateRangePicker className="h-8" value={range} onChange={setRange} />
      }
    >
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
          <Totals requests={summary.requests} tokens={summary.tokens} />
          {summary.models.length ? (
            <TotalsTable
              rows={summary.models}
              firstColumn={t("api_keys.fields.model")}
              detailed
              testId="sa-usage-models"
            />
          ) : (
            <EmptyState variant="inline">
              {t("api_keys.team.usageEmpty")}
            </EmptyState>
          )}
        </>
      )}
    </ShowPage.Section>
  );
}
