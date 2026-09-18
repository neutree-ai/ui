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
  const showWeight =
    strategy === "weighted" || route.targets.some((target) => target.weight);
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
    <div className="rounded-md bg-muted/35 p-4">
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
      <div className="mt-3 max-w-5xl overflow-x-auto">
        <table
          aria-label={route.model}
          className="w-full min-w-[480px] table-fixed text-left text-sm [&_td]:px-3 [&_td]:py-3 [&_th]:px-3 [&_th]:py-2 [&_th]:font-medium [&_tr>:first-child]:pl-0 [&_tr>:last-child]:pr-0"
        >
          <colgroup>
            <col className="w-[24%]" />
            <col className={showRole || showWeight ? "w-[32%]" : "w-[52%]"} />
            {showRole && <col className={showWeight ? "w-[10%]" : "w-[20%]"} />}
            {showWeight && <col className={showRole ? "w-[10%]" : "w-[20%]"} />}
            <col className="w-[24%]" />
          </colgroup>
          <thead className="border-b border-border/40 text-xs text-muted-foreground">
            <tr>
              <th scope="col">{t("external_endpoints.fields.provider")}</th>
              <th scope="col">
                {t("external_endpoints.fields.upstreamModelName")}
              </th>
              {showRole && (
                <th scope="col">{t("external_endpoints.fields.role")}</th>
              )}
              {showWeight && (
                <th scope="col" className="text-right">
                  {t("external_endpoints.fields.weight")}
                </th>
              )}
              <th scope="col" className="text-right">
                {t("external_endpoints.fields.maxInflightRequests")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {route.targets.map((target, index) => (
              <tr key={`${target.upstream}-${target.upstream_model}-${index}`}>
                <td className="break-all">{target.upstream}</td>
                <td>
                  <code className="break-all text-xs">
                    {target.upstream_model || "-"}
                  </code>
                </td>
                {showRole && (
                  <td className="whitespace-nowrap font-medium">
                    {(target.priority ?? 0) === primaryPriority
                      ? t("external_endpoints.options.primaryRole")
                      : t("external_endpoints.options.fallbackRole")}
                  </td>
                )}
                {showWeight && (
                  <td className="text-right tabular-nums">
                    {target.weight || 1}
                  </td>
                )}
                <td className="whitespace-nowrap text-right tabular-nums text-muted-foreground">
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
