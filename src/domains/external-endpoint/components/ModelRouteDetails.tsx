import { Activity, Pencil, Terminal } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ModelRoute } from "@/domains/external-endpoint/types";
import { EmptyValue } from "@/foundation/components/EmptyValue";
import { ModelSourceBadge } from "@/foundation/components/ModelSourceBadge";
import { useTranslation } from "@/foundation/lib/i18n";
import type { ModelSource } from "@/foundation/lib/model-source";
import { cn } from "@/foundation/lib/utils";
import CurlExample from "./CurlExample";

type Props = {
  route: ModelRoute;
  source?: ModelSource;
  editUrl: string;
  serviceUrl?: string;
  onViewMonitoring?: () => void;
};

export default function ModelRouteDetails({
  route,
  source,
  editUrl,
  serviceUrl,
  onViewMonitoring,
}: Props) {
  const { t } = useTranslation();
  const strategy = route.strategy ?? "fixed";
  const showRole = strategy === "priority";
  const showWeight = strategy === "weighted";
  const totalWeight = route.targets.reduce(
    (sum, target) => sum + (target.weight || 1),
    0,
  );
  const rowClassName = cn(
    "grid items-center text-left [&>*]:min-w-0 [&>*]:px-3",
    // Weighted targets have no concurrency limit — the editor replaces the
    // limit field with the weight — so this table has no such column for them
    // rather than printing "Unlimited" as if it were configured.
    showWeight ? "grid-cols-[4fr_5fr_1.5fr]" : "grid-cols-[4fr_5fr_3fr]",
  );
  const primaryPriority = Math.min(
    ...route.targets.map((target) => target.priority ?? 0),
  );
  const strategyLabel =
    strategy === "priority"
      ? t("external_endpoints.options.priorityRouting")
      : strategy === "weighted"
        ? t("external_endpoints.options.weightedRouting")
        : t("external_endpoints.options.fixedRouting");

  const strategyColor =
    strategy === "priority"
      ? "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300"
      : strategy === "weighted"
        ? "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300"
        : "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300";

  return (
    <div className="rounded-md border border-border/60 bg-muted/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {/* Same treatment as the editor's route-card title: neutral ink, one
              step below the section heading it sits under. The filled primary
              chip made the card title (18px) larger than its own section
              heading (16px), and colour is reserved here for the source and
              strategy badges. */}
          <h3 className="min-w-0 break-all text-base font-semibold text-foreground">
            {route.model}
          </h3>
          <ModelSourceBadge source={source} />
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "rounded-md px-2 py-1 text-xs font-medium",
              strategyColor,
            )}
          >
            {strategyLabel}
          </span>
          {/* The chip is a label, everything after it is a control. Without the
              rule the strategy chip reads as a fourth, differently shaped
              action in the same row. */}
          <span aria-hidden="true" className="h-4 w-px shrink-0 bg-border" />
          <Button asChild variant="ghost" size="sm" className="h-7 px-2">
            <Link to={editUrl}>
              <Pencil />
              {t("buttons.edit")}
            </Link>
          </Button>
          {onViewMonitoring && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={onViewMonitoring}
            >
              <Activity />
              {t("external_endpoints.monitor.view")}
            </Button>
          )}
          <Dialog>
            <DialogTrigger asChild>
              {/* The trigger has to be the button itself: wrapping it in a span
                  moves the trigger onto the wrapper, and a disabled button only
                  stops its own click — the wrapper still fires and opens an
                  empty dialog. `title` carries the reason on a best-effort
                  basis; `aria-label` is what assistive tech reads. */}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                disabled={!serviceUrl}
                title={
                  serviceUrl
                    ? undefined
                    : t("external_endpoints.messages.testRequiresServing")
                }
                aria-label={
                  serviceUrl
                    ? undefined
                    : t("external_endpoints.messages.testRequiresServing")
                }
              >
                <Terminal />
                {t("external_endpoints.actions.testModel")}
              </Button>
            </DialogTrigger>
            <DialogContent
              className="max-h-[85vh] max-w-3xl overflow-y-auto"
              aria-describedby={undefined}
            >
              <DialogHeader>
                <DialogTitle className="break-all pr-6">
                  {t("external_endpoints.actions.testModel")} · {route.model}
                </DialogTitle>
              </DialogHeader>
              {serviceUrl && (
                <CurlExample
                  serviceUrl={serviceUrl}
                  models={[route.model]}
                  className="mt-0 min-w-0 border-0 shadow-none"
                />
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <div className="mt-3 overflow-x-auto">
        {/* Same table rhythm as the Upstream Channels mapping table on this
            page (and as the shared list Table): 8px cells, header band with no
            underline, default row dividers. The two tables sit side by side and
            drifted because each restated its own classes. */}
        <table
          aria-label={route.model}
          className="block w-full min-w-[640px] text-left text-sm [&_td]:py-2 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold"
        >
          {/* bg-muted/80 + semibold heads: the shared TableHeader's treatment.
              At /40 with a 500 head the band barely separated from the card. */}
          <thead className="block bg-muted/80 text-xs text-muted-foreground">
            <tr className={rowClassName}>
              <th scope="col">{t("external_endpoints.fields.provider")}</th>
              <th scope="col">
                {t("external_endpoints.fields.upstreamModelName")}
              </th>
              {showWeight && (
                <th scope="col">
                  {t("external_endpoints.fields.trafficWeight")}
                </th>
              )}
              {!showWeight && (
                <th scope="col">
                  {t("external_endpoints.fields.maxInflightRequests")}
                </th>
              )}
            </tr>
          </thead>
          <tbody className="block divide-y">
            {route.targets.map((target, index) => (
              <tr
                className={rowClassName}
                key={`${target.upstream}-${target.upstream_model}-${index}`}
              >
                <td>
                  <div className="flex items-center justify-start gap-2">
                    {showRole && (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium",
                          (target.priority ?? 0) === primaryPriority
                            ? "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300"
                            : "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className="h-1.5 w-1.5 rounded-full bg-current"
                        />
                        {(target.priority ?? 0) === primaryPriority
                          ? t("external_endpoints.options.primaryRole")
                          : t("external_endpoints.options.fallbackRole")}
                      </span>
                    )}
                    <span className="min-w-0 break-all">{target.upstream}</span>
                  </div>
                </td>
                <td>
                  <code className="break-all text-xs">
                    {target.upstream_model || <EmptyValue />}
                  </code>
                </td>
                {showWeight && (
                  <td className="text-left tabular-nums">
                    {Number(
                      (((target.weight || 1) / totalWeight) * 100).toFixed(2),
                    )}
                    %
                  </td>
                )}
                {!showWeight && (
                  <td className="text-left tabular-nums text-muted-foreground">
                    {target.max_inflight_requests ||
                      t("external_endpoints.fields.unlimited")}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
