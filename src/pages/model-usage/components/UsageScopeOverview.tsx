import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { useTranslation } from "@/foundation/lib/i18n";
import { MetricBar, type MetricBarSeries } from "@/foundation/role/MetricBar";
import { formatTokens } from "@/foundation/role/unit";
import type { UsageScope } from "@/pages/model-usage/lib/usage-scope";
import {
  formatShare,
  shareOf,
  type UsageSeries,
} from "@/pages/model-usage/lib/usage-series";

/** How many entries a block lists before the rest folds into one row. */
const TOP_N = 8;

// The Organization page's Teams and scenarios tab.
const ORGANIZATION_TEAMS = "/organization?tab=teams";

export type OverviewRow = UsageSeries & { target: UsageScope | null };

type BlockProps = {
  testId: string;
  title: string;
  hint?: string;
  rows: OverviewRow[];
  total: number;
  series: MetricBarSeries;
  loading: boolean;
  /** Set when none exists at all, rather than none with usage. */
  noneYet?: string;
  onOpen: (target: UsageScope) => void;
  onViewAll: () => void;
};

const Block = ({
  testId,
  title,
  hint,
  rows,
  total,
  series,
  loading,
  noneYet,
  onOpen,
  onViewAll,
}: BlockProps) => {
  const { t } = useTranslation();
  const shown = rows.slice(0, TOP_N);
  const rest = rows.slice(TOP_N);
  const restTotal = rest.reduce((sum, r) => sum + r.total, 0);
  const restRequests = rest.reduce((sum, r) => sum + (r.requests ?? 0), 0);
  const line = (tokens: number, requests: number) =>
    t("model_usage.modelShare.tokensAndRequests", {
      tokens: formatTokens(tokens),
      requests: requests.toLocaleString(),
    });
  return (
    <Card className="flex min-w-0 flex-col p-4" data-testid={testId}>
      <div className="text-sm font-medium">{title}</div>
      <div className="mb-3 min-h-4 text-xs text-muted-foreground">{hint}</div>
      {rows.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-8 text-sm text-muted-foreground">
          {loading ? (
            "…"
          ) : noneYet ? (
            <div className="space-y-2 text-center">
              <p>{noneYet}</p>
              <Link
                className="text-xs text-primary hover:underline"
                to={ORGANIZATION_TEAMS}
              >
                {t("model_usage.overview.goToTeams")}
              </Link>
            </div>
          ) : (
            t("model_usage.empty")
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {shown.map((row) => {
            const body = (
              <>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate">{row.name}</span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {formatShare(row.total, total)}
                  </span>
                </div>
                <MetricBar
                  className="mt-1"
                  size="sm"
                  shape="rounded"
                  series={series}
                  value={shareOf(row.total, total)}
                />
                <div className="mt-1 font-mono text-xs text-muted-foreground">
                  {line(row.total, row.requests ?? 0)}
                </div>
              </>
            );
            return (
              <li key={row.key}>
                {row.target ? (
                  <button
                    type="button"
                    className="w-full rounded-md px-1.5 py-1 text-left text-sm hover:bg-muted"
                    onClick={() => row.target && onOpen(row.target)}
                  >
                    {body}
                  </button>
                ) : (
                  <div className="w-full px-1.5 py-1 text-sm">{body}</div>
                )}
              </li>
            );
          })}
          {rest.length > 0 ? (
            <li className="px-1.5 py-1 text-sm" data-testid={`${testId}-rest`}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-muted-foreground">
                  {t("model_usage.overview.others", { n: rest.length })}
                </span>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {formatShare(restTotal, total)}
                </span>
              </div>
              <div className="mt-1 font-mono text-xs text-muted-foreground">
                {line(restTotal, restRequests)}
              </div>
            </li>
          ) : null}
        </ul>
      )}
      {rest.length > 0 ? (
        <button
          type="button"
          className="mt-3 self-start text-xs text-primary hover:underline"
          onClick={onViewAll}
        >
          {t("model_usage.overview.viewAll")}
        </button>
      ) : null}
    </Card>
  );
};

/**
 * The platform at a glance: who used it, by department, Team and scenario,
 * each ranked with its share of the platform's total. Picking an entry
 * scopes the page to it.
 */
export const UsageScopeOverview = ({
  departments,
  teams,
  scenarios,
  total,
  teamsLoading,
  noTeams,
  noScenarios,
  onOpen,
  onViewDepartments,
  onViewTeams,
}: {
  departments: OverviewRow[];
  teams: OverviewRow[];
  scenarios: OverviewRow[];
  total: number;
  teamsLoading: boolean;
  noTeams: boolean;
  noScenarios: boolean;
  onOpen: (target: UsageScope) => void;
  onViewDepartments: () => void;
  onViewTeams: () => void;
}) => {
  const { t } = useTranslation();
  return (
    <div
      className="grid gap-4 p-4 lg:grid-cols-3"
      data-testid="usage-scope-overview"
    >
      <Block
        testId="usage-overview-departments"
        title={t("model_usage.overview.departments")}
        rows={departments}
        total={total}
        series="blue"
        loading={false}
        onOpen={onOpen}
        onViewAll={onViewDepartments}
      />
      <Block
        testId="usage-overview-teams"
        title={t("model_usage.overview.teams")}
        hint={t("model_usage.overview.overlapHint")}
        rows={teams}
        total={total}
        series="teal"
        loading={teamsLoading}
        noneYet={noTeams ? t("model_usage.overview.noTeams") : undefined}
        onOpen={onOpen}
        onViewAll={onViewTeams}
      />
      <Block
        testId="usage-overview-scenarios"
        title={t("model_usage.overview.scenarios")}
        hint={t("model_usage.overview.overlapHint")}
        rows={scenarios}
        total={total}
        series="violet"
        loading={teamsLoading}
        noneYet={
          noScenarios ? t("model_usage.overview.noScenarios") : undefined
        }
        onOpen={onOpen}
        onViewAll={onViewTeams}
      />
    </div>
  );
};
