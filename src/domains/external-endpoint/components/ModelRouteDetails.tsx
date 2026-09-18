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
import { useTranslation } from "@/foundation/lib/i18n";
import { cn } from "@/foundation/lib/utils";
import CurlExample from "./CurlExample";

type Props = {
  route: ModelRoute;
  editUrl: string;
  serviceUrl?: string;
};

export default function ModelRouteDetails({
  route,
  editUrl,
  serviceUrl,
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
    showWeight ? "grid-cols-[4fr_5fr_1.5fr_1.5fr]" : "grid-cols-[4fr_5fr_3fr]",
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
        <div className="text-base font-semibold text-foreground">
          {route.model}
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
          <Button asChild variant="ghost" size="sm" className="h-7 px-2">
            <Link to={editUrl}>{t("buttons.edit")}</Link>
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                disabled={!serviceUrl}
              >
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
        <table
          aria-label={route.model}
          className="block w-full min-w-[640px] text-left text-sm [&_td]:py-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-medium"
        >
          <thead className="block border-b border-border/40 bg-muted/40 text-xs text-muted-foreground">
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
              <th scope="col">
                {t("external_endpoints.fields.maxInflightRequests")}
              </th>
            </tr>
          </thead>
          <tbody className="block divide-y divide-border/40">
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
                    {target.upstream_model || "-"}
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
                <td className="text-left tabular-nums text-muted-foreground">
                  {target.max_inflight_requests ||
                    t("external_endpoints.fields.unlimited")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
