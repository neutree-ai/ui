import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { readMonitoringState } from "@/domains/external-endpoint/lib/monitoring-state";
import type { ExternalEndpoint } from "@/domains/external-endpoint/types";
import GrafanaDashboard from "@/foundation/components/GrafanaDashboard";
import { useSystemApi } from "@/foundation/hooks/use-system-api";
import { getModelRoutingDashboardProps } from "@/foundation/lib/grafana-dashboard-configs";
import { buildGrafanaDashboardUrl } from "@/foundation/lib/grafana-dashboard-url";
import { useTranslation } from "@/foundation/lib/i18n";

export default function ExternalEndpointMonitor({
  record,
  onViewConfiguration,
}: {
  record: ExternalEndpoint;
  onViewConfiguration: () => void;
}) {
  const { t } = useTranslation();
  const { grafanaUrl, isLoading, error, refetch } = useSystemApi();
  const [params, setParams] = useSearchParams();
  const routes = record.spec.model_routes ?? [];
  const state = readMonitoringState(params);
  const current = routes.find((route) => route.model === state.model);
  const [custom, setCustom] = useState(state.absolute);
  const localDateTime = (milliseconds: number) => {
    const date = new Date(milliseconds);
    return new Date(milliseconds - date.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  };
  const [start, setStart] = useState(() =>
    localDateTime(state.absolute ? Number(state.from) : Date.now() - 3600000),
  );
  const [end, setEnd] = useState(() =>
    localDateTime(state.absolute ? Number(state.to) : Date.now()),
  );
  const [rangeError, setRangeError] = useState(false);
  const update = (changes: Record<string, string>) =>
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      for (const [key, value] of Object.entries(changes)) {
        if (key === "model" && !value) next.delete(key);
        else next.set(key, value);
      }
      return next;
    });
  const props =
    grafanaUrl && record.metadata.workspace
      ? getModelRoutingDashboardProps(grafanaUrl, {
          workspace: record.metadata.workspace,
          endpoint: record.metadata.name,
          model: state.model,
          mode: state.mode,
          from: state.from,
          to: state.to,
          refresh: state.refresh,
        })
      : null;

  if (!routes.length)
    return (
      <p className="p-6 text-muted-foreground">
        {t("external_endpoints.monitor.legacy")}
      </p>
    );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-md border bg-card p-4">
        <div className="min-w-48 flex-1 space-y-1">
          <label htmlFor="monitor-model" className="text-sm">
            {t("external_endpoints.fields.virtualModel")}
          </label>
          <Select
            value={state.model === null ? "all" : `model:${state.model}`}
            onValueChange={(value) =>
              update({ model: value === "all" ? "" : value.slice(6) })
            }
          >
            <SelectTrigger id="monitor-model">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t("external_endpoints.monitor.allModels")}
              </SelectItem>
              {state.model !== null && !current && (
                <SelectItem value={`model:${state.model}`}>
                  {state.model}
                </SelectItem>
              )}
              {routes.map((route) => (
                <SelectItem key={route.model} value={`model:${route.model}`}>
                  {route.model}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-40 space-y-1">
          <label htmlFor="monitor-mode" className="text-sm">
            {t("external_endpoints.monitor.mode")}
          </label>
          <Select value={state.mode} onValueChange={(mode) => update({ mode })}>
            <SelectTrigger id="monitor-mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t("external_endpoints.monitor.all")}
              </SelectItem>
              <SelectItem value="stream">
                {t("external_endpoints.monitor.stream")}
              </SelectItem>
              <SelectItem value="non_stream">
                {t("external_endpoints.monitor.nonStream")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-40 space-y-1">
          <label htmlFor="monitor-time" className="text-sm">
            {t("external_endpoints.monitor.timeRange")}
          </label>
          <Select
            value={custom || state.absolute ? "custom" : state.from}
            onValueChange={(value) => {
              setCustom(value === "custom");
              if (value !== "custom") update({ from: value, to: "now" });
            }}
          >
            <SelectTrigger id="monitor-time">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="now-15m">
                {t("external_endpoints.monitor.last15m")}
              </SelectItem>
              <SelectItem value="now-1h">
                {t("external_endpoints.monitor.last1h")}
              </SelectItem>
              <SelectItem value="now-6h">
                {t("external_endpoints.monitor.last6h")}
              </SelectItem>
              <SelectItem value="now-24h">
                {t("external_endpoints.monitor.last24h")}
              </SelectItem>
              <SelectItem value="now-7d">
                {t("external_endpoints.monitor.last7d")}
              </SelectItem>
              <SelectItem value="custom">
                {t("external_endpoints.monitor.custom")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          disabled={state.absolute}
          onClick={() => update({ refresh: state.refresh ? "off" : "30s" })}
        >
          {state.refresh
            ? t("external_endpoints.monitor.pause")
            : t("external_endpoints.monitor.resume")}
        </Button>
        {props && (
          <Button asChild variant="outline">
            <a
              href={buildGrafanaDashboardUrl(props)}
              target="_blank"
              rel="noreferrer"
            >
              {t("external_endpoints.monitor.open")}
            </a>
          </Button>
        )}
        {custom && (
          <form
            className="flex w-full flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              const from = new Date(start).getTime(),
                to = new Date(end).getTime();
              const valid =
                Number.isFinite(from) && Number.isFinite(to) && from < to;
              setRangeError(!valid);
              if (valid)
                update({ from: String(from), to: String(to), refresh: "off" });
            }}
          >
            <label htmlFor="monitor-from" className="space-y-1 text-sm">
              {t("external_endpoints.monitor.from")}
              <Input
                id="monitor-from"
                type="datetime-local"
                required
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            <label htmlFor="monitor-to" className="space-y-1 text-sm">
              {t("external_endpoints.monitor.to")}
              <Input
                id="monitor-to"
                type="datetime-local"
                required
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </label>
            <Button type="submit">
              {t("external_endpoints.monitor.apply")}
            </Button>
            {rangeError && (
              <p role="alert" className="text-destructive">
                {t("external_endpoints.monitor.invalidRange")}
              </p>
            )}
          </form>
        )}
      </div>
      {state.model !== null && !current && (
        <p
          role="status"
          className="rounded-md border border-orange-300 p-3 text-sm"
        >
          {t("external_endpoints.monitor.historicalModel")}
        </p>
      )}
      {current && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-4 text-sm">
          <div>
            <p className="font-medium">
              {t("external_endpoints.monitor.currentConfig")}
            </p>
            <p className="mt-1 text-muted-foreground">
              {current.strategy === "weighted"
                ? t("external_endpoints.options.weightedRouting")
                : current.strategy === "priority"
                  ? t("external_endpoints.options.priorityRouting")
                  : t("external_endpoints.options.fixedRouting")}
              {current.targets.map((target) => (
                <span
                  key={`${target.upstream}/${target.upstream_model}`}
                  className="ml-3 inline-block break-all"
                >
                  {target.upstream} / {target.upstream_model}
                  {current.strategy === "weighted"
                    ? ` (${target.weight ?? 1}%)`
                    : current.strategy === "priority"
                      ? ` (${t("external_endpoints.monitor.priority")}: ${target.priority ?? 0})`
                      : ""}
                </span>
              ))}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("external_endpoints.monitor.configHint")}
            </p>
          </div>
          <Button variant="outline" onClick={onViewConfiguration}>
            {t("external_endpoints.monitor.viewConfig")}
          </Button>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {t("external_endpoints.monitor.scope")}
      </p>
      {props ? (
        <>
          <div className="h-[1450px]">
            <GrafanaDashboard {...props} />
          </div>
          <p className="text-xs text-muted-foreground">
            {t("external_endpoints.monitor.embedHelp")}
          </p>
        </>
      ) : (
        <div className="rounded-md border p-8 text-center text-muted-foreground">
          {isLoading ? (
            t("external_endpoints.monitor.loading")
          ) : error ? (
            <>
              <p>{t("external_endpoints.monitor.configError")}</p>
              <Button variant="outline" onClick={() => refetch()}>
                {t("external_endpoints.monitor.retry")}
              </Button>
            </>
          ) : (
            t("common.messages.grafanaNotConfigured")
          )}
        </div>
      )}
    </div>
  );
}
