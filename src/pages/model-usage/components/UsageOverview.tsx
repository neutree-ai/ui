import { Card } from "@/components/ui/card";
import { MetricBar } from "@/foundation/components/MetricBar";
import { useTranslation } from "@/foundation/lib/i18n";
import { formatTokens } from "@/foundation/lib/unit";
import { cn } from "@/foundation/lib/utils";
import type { UsageTotals } from "@/pages/model-usage/lib/usage-scope";
import {
  changeOf,
  formatShare,
  shareOf,
  type UsageSeries,
} from "@/pages/model-usage/lib/usage-series";

/** Who made the scope's usage, for a scope counted by user. */
type UsageActivity = { users: number; applications: number };

/**
 * The scope's totals: all, prompt and completion tokens, and requests. The
 * total compares with the previous period of the same length; null while it
 * is unknown.
 */
export const UsageSummary = ({
  totals,
  previousTotal,
  activity,
}: {
  totals: UsageTotals;
  previousTotal: number | null;
  activity: UsageActivity | null;
}) => {
  const { t } = useTranslation();
  const changeFoot = () => {
    if (previousTotal === null) return null;
    const change = changeOf(totals.total, previousTotal);
    if (change === null) return t("model_usage.summary.noPrevious");
    const arrow = change >= 0 ? "↑" : "↓";
    return t("model_usage.summary.change", {
      change: `${arrow} ${Math.abs(change).toFixed(1)}%`,
    });
  };
  const cards = [
    {
      key: "total",
      label: t("model_usage.summary.total"),
      value: formatTokens(totals.total),
      foot: changeFoot(),
    },
    {
      key: "prompt",
      label: t("model_usage.summary.prompt"),
      value: formatTokens(totals.prompt),
      foot: t("model_usage.summary.share", {
        share: formatShare(totals.prompt, totals.total),
      }),
    },
    {
      key: "completion",
      label: t("model_usage.summary.completion"),
      value: formatTokens(totals.completion),
      foot: t("model_usage.summary.share", {
        share: formatShare(totals.completion, totals.total),
      }),
    },
    ...(totals.requests === undefined
      ? []
      : [
          {
            key: "requests",
            label: t("model_usage.summary.requests"),
            value: totals.requests.toLocaleString(),
            foot: activity
              ? t("model_usage.summary.activity", {
                  users: activity.users,
                  applications: activity.applications,
                })
              : null,
          },
        ]),
  ];
  return (
    <div
      className={cn(
        "grid gap-4 sm:grid-cols-2",
        cards.length === 4 ? "xl:grid-cols-4" : "xl:grid-cols-3",
      )}
    >
      {cards.map((card) => (
        <Card
          key={card.key}
          className="px-4 py-3"
          data-testid={`usage-summary-${card.key}`}
        >
          <div className="text-xs text-muted-foreground">{card.label}</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {card.value}
          </div>
          <div className="mt-0.5 h-4 text-xs text-muted-foreground">
            {card.foot}
          </div>
        </Card>
      ))}
    </div>
  );
};

/**
 * Each model's share of the scope's tokens. Picking a model filters the
 * whole page to it; picking it again clears the filter.
 */
export const ModelShare = ({
  models,
  total,
  selected,
  onSelect,
}: {
  models: UsageSeries[];
  total: number;
  selected: string;
  onSelect: (model: string) => void;
}) => {
  const { t } = useTranslation();
  // Usage by API key carries no request count.
  const showRequests = models.some((m) => m.requests !== undefined);
  return (
    <Card className="flex flex-col p-4">
      <div className="mb-1 text-sm font-medium">
        {t("model_usage.modelShare.title")}
      </div>
      <div className="mb-3 text-xs text-muted-foreground">
        {t("model_usage.modelShare.active", { n: models.length })}
      </div>
      {models.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-8 text-sm text-muted-foreground">
          {t("model_usage.empty")}
        </div>
      ) : (
        <ul className="max-h-[220px] space-y-2 overflow-y-auto">
          {models.map((model) => {
            const active = selected === model.key;
            const share = formatShare(model.total, total);
            return (
              <li key={model.key}>
                <button
                  type="button"
                  className={cn(
                    "w-full rounded-md px-1.5 py-1 text-left text-sm",
                    active ? "bg-accent" : "hover:bg-muted",
                  )}
                  aria-pressed={active}
                  title={t("model_usage.modelShare.filter")}
                  onClick={() => onSelect(active ? "" : model.key)}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate">{model.name}</span>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      {share}
                    </span>
                  </div>
                  <MetricBar
                    className="mt-1"
                    size="sm"
                    shape="rounded"
                    value={shareOf(model.total, total)}
                  />
                  <div className="mt-1 font-mono text-xs text-muted-foreground">
                    {showRequests
                      ? t("model_usage.modelShare.tokensAndRequests", {
                          tokens: formatTokens(model.total),
                          requests: (model.requests ?? 0).toLocaleString(),
                        })
                      : t("model_usage.modelShare.tokens", {
                          tokens: formatTokens(model.total),
                        })}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
};
