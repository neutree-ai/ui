import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import dayjs from "dayjs";
import {
  Calendar,
  ChevronDown,
  Clock,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { useTheme } from "next-themes";
import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";

export interface PanelConfig {
  id: number;
  title?: string;
  width?: number;
  height?: number;
  gridArea?: string;
}

export interface DashboardConfig {
  baseUrl: string;
  dashboardId: string;
  orgId?: number;
  theme?: "light" | "dark";
  timezone?: string;
  variables?: Record<string, string>;
}

export interface TimeRange {
  from: string;
  to: string;
  display: string;
}

export interface GrafanaPanelsProps {
  dashboardConfig: DashboardConfig;
  panels: PanelConfig[];
  defaultTimeRange?: TimeRange;
  refreshIntervals?: number[];
  enableAutoRefresh?: boolean;
  className?: string;
  onTimeRangeChange?: (range: TimeRange) => void;
  onRefreshIntervalChange?: (interval: number) => void;
}

const getDefaultTimeRanges = (t: (key: string) => string): TimeRange[] => [
  {
    from: "now-5m",
    to: "now",
    display: t("components.grafanaPanels.timeRange.last5minutes"),
  },
  {
    from: "now-15m",
    to: "now",
    display: t("components.grafanaPanels.timeRange.last15minutes"),
  },
  {
    from: "now-30m",
    to: "now",
    display: t("components.grafanaPanels.timeRange.last30minutes"),
  },
  {
    from: "now-1h",
    to: "now",
    display: t("components.grafanaPanels.timeRange.last1hour"),
  },
  {
    from: "now-3h",
    to: "now",
    display: t("components.grafanaPanels.timeRange.last3hours"),
  },
  {
    from: "now-6h",
    to: "now",
    display: t("components.grafanaPanels.timeRange.last6hours"),
  },
  {
    from: "now-12h",
    to: "now",
    display: t("components.grafanaPanels.timeRange.last12hours"),
  },
  {
    from: "now-24h",
    to: "now",
    display: t("components.grafanaPanels.timeRange.last24hours"),
  },
  {
    from: "now-2d",
    to: "now",
    display: t("components.grafanaPanels.timeRange.last2days"),
  },
  {
    from: "now-7d",
    to: "now",
    display: t("components.grafanaPanels.timeRange.last7days"),
  },
  {
    from: dayjs().startOf("day").valueOf().toString(),
    to: dayjs().endOf("day").valueOf().toString(),
    display: t("components.grafanaPanels.timeRange.today"),
  },
];

const DEFAULT_REFRESH_INTERVALS = [0, 5, 10, 30, 60, 300, 600, 1800, 3600];

export default function GrafanaPanels({
  dashboardConfig,
  panels,
  defaultTimeRange,
  refreshIntervals = DEFAULT_REFRESH_INTERVALS,
  enableAutoRefresh = true,
  className,
  onTimeRangeChange,
  onRefreshIntervalChange,
}: GrafanaPanelsProps) {
  const { t } = useTranslation();
  const DEFAULT_TIME_RANGES = useMemo(() => getDefaultTimeRanges(t), [t]);

  const [currentTimeRange, setCurrentTimeRange] = useState<TimeRange>(
    defaultTimeRange || DEFAULT_TIME_RANGES[3],
  ); // Last 1 hour
  const [refreshInterval, setRefreshInterval] = useState<number>(0);
  const [isAutoRefreshing, setIsAutoRefreshing] = useState<boolean>(false);
  // Manual refresh trigger for cache-busting when user clicks refresh button
  const [manualRefreshTrigger, setManualRefreshTrigger] = useState<number>(0);
  const { theme } = useTheme();

  const buildCommonParams = useMemo(() => {
    const params = new URLSearchParams();

    if (dashboardConfig.orgId) {
      params.append("orgId", dashboardConfig.orgId.toString());
    }

    if (dashboardConfig.theme || theme) {
      params.append("theme", dashboardConfig.theme || theme || "light");
    }

    if (dashboardConfig.timezone) {
      params.append("timezone", dashboardConfig.timezone);
    }

    if (dashboardConfig.variables) {
      for (const [key, value] of Object.entries(dashboardConfig.variables)) {
        params.append(`var-${key}`, value);
      }
    }

    return params.toString();
  }, [dashboardConfig, theme]);

  // Convert refresh interval to Grafana format
  // This leverages Grafana's built-in auto-refresh capability instead of manually reloading iframes
  const grafanaRefreshParam = useMemo(() => {
    if (!isAutoRefreshing || refreshInterval === 0) return "";
    if (refreshInterval < 60) return `${refreshInterval}s`;
    if (refreshInterval < 3600) return `${Math.floor(refreshInterval / 60)}m`;
    return `${Math.floor(refreshInterval / 3600)}h`;
  }, [isAutoRefreshing, refreshInterval]);

  const panelUrls = useMemo(() => {
    return panels.map((panel) => {
      const url = new URL(
        `/d-solo/${dashboardConfig.dashboardId}`,
        dashboardConfig.baseUrl,
      );
      url.searchParams.append("panelId", panel.id.toString());
      url.searchParams.append("from", currentTimeRange.from);
      url.searchParams.append("to", currentTimeRange.to);

      if (grafanaRefreshParam) {
        url.searchParams.append("refresh", grafanaRefreshParam);
      }

      // Add common dashboard parameters
      const commonParams = buildCommonParams;
      if (commonParams) {
        const params = new URLSearchParams(commonParams);
        for (const [key, value] of params) {
          url.searchParams.append(key, value);
        }
      }

      // Add manual refresh trigger as cache-busting parameter only when needed
      if (manualRefreshTrigger > 0) {
        url.searchParams.append("_t", manualRefreshTrigger.toString());
      }

      return url.toString();
    });
  }, [
    panels,
    dashboardConfig,
    currentTimeRange,
    buildCommonParams,
    grafanaRefreshParam,
    manualRefreshTrigger,
  ]);

  const handleTimeRangeChange = useCallback(
    (range: TimeRange) => {
      setCurrentTimeRange(range);
      onTimeRangeChange?.(range);
    },
    [onTimeRangeChange],
  );

  const handleRefreshIntervalChange = useCallback(
    (interval: number) => {
      setRefreshInterval(interval);
      setIsAutoRefreshing(interval > 0);
      onRefreshIntervalChange?.(interval);
    },
    [onRefreshIntervalChange],
  );

  const handleManualRefresh = useCallback(() => {
    const timestamp = Date.now();
    setManualRefreshTrigger(timestamp);

    // Clear the manual refresh trigger after URL update to avoid permanent URL pollution
    setTimeout(() => {
      setManualRefreshTrigger(0);
    }, 100);
  }, []);

  const toggleAutoRefresh = useCallback(() => {
    if (refreshInterval > 0) {
      setIsAutoRefreshing(!isAutoRefreshing);
    }
  }, [refreshInterval, isAutoRefreshing]);

  const formatRefreshInterval = (seconds: number): string => {
    if (seconds === 0) return t("components.grafanaPanels.refresh.off");
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${seconds / 60}m`;
    return `${seconds / 3600}h`;
  };

  return (
    <div className={`space-y-4 ${className || ""}`}>
      {/* Control Panel */}
      <Card className="p-2">
        <CardContent className="p-0">
          <div className="flex flex-wrap items-center gap-3">
            {/* Time Range Selector */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {currentTimeRange.display}
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2">
                <div className="space-y-1">
                  <div className="font-medium text-sm mb-2">
                    {t("components.grafanaPanels.timeRange.title")}
                  </div>
                  {DEFAULT_TIME_RANGES.map((range) => (
                    <Button
                      key={`${range.from}-${range.to}`}
                      variant={
                        currentTimeRange.from === range.from &&
                        currentTimeRange.to === range.to
                          ? "default"
                          : "ghost"
                      }
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => handleTimeRangeChange(range)}
                    >
                      {range.display}
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <Separator orientation="vertical" className="h-6" />

            {/* Refresh Controls */}
            {enableAutoRefresh && (
              <>
                <Select
                  value={refreshInterval.toString()}
                  onValueChange={(value) =>
                    handleRefreshIntervalChange(Number(value))
                  }
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {refreshIntervals.map((interval) => (
                      <SelectItem key={interval} value={interval.toString()}>
                        {formatRefreshInterval(interval)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {refreshInterval > 0 && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={toggleAutoRefresh}
                    className={
                      isAutoRefreshing ? "text-green-600" : "text-gray-400"
                    }
                  >
                    {isAutoRefreshing ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </>
            )}

            <Button
              variant="outline"
              size="icon"
              onClick={handleManualRefresh}
              title={t("components.grafanaPanels.refresh.refreshNow")}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>

            <Separator orientation="vertical" className="h-6" />

            {/* Status Info */}

            {isAutoRefreshing && (
              <Badge
                variant="secondary"
                className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
              >
                {t("components.grafanaPanels.refresh.autoRefresh")}{" "}
                {formatRefreshInterval(refreshInterval)}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Panels Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {panels.map((panel, index) => (
          <Card key={panel.id} className="overflow-hidden">
            {panel.title && (
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">
                  {panel.title}
                </CardTitle>
              </CardHeader>
            )}
            <CardContent className={panel.title ? "p-0 pt-0" : "p-0"}>
              <div className="relative">
                <iframe
                  src={panelUrls[index]}
                  width={panel.width || "100%"}
                  height={panel.height || 300}
                  className="w-full border-0 rounded-md"
                  title={
                    panel.title ||
                    t("components.grafanaPanels.defaultPanelTitle", {
                      id: panel.id,
                    })
                  }
                  loading="lazy"
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
