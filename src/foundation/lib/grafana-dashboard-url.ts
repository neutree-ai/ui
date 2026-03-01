export interface GrafanaDashboardConfig {
  baseUrl: string;
  dashboardId: string;
  orgId?: number;
  theme?: "light" | "dark";
  timezone?: string;
  variables?: Record<string, string>;
}

export interface GrafanaDashboardUrlOptions {
  dashboardConfig: GrafanaDashboardConfig;
  resolvedTheme?: string;
  initialFrom?: string;
  initialTo?: string;
  initialRefresh?: string;
  hideVariables?: boolean;
  hideTimePicker?: boolean;
}

export function buildGrafanaDashboardUrl({
  dashboardConfig,
  resolvedTheme,
  initialFrom = "now-1h",
  initialTo = "now",
  initialRefresh = "30s",
  hideVariables = false,
  hideTimePicker = false,
}: GrafanaDashboardUrlOptions): string {
  const url = new URL(
    `/d/${dashboardConfig.dashboardId}`,
    dashboardConfig.baseUrl,
  );

  url.searchParams.append("from", initialFrom);
  url.searchParams.append("to", initialTo);

  if (initialRefresh) {
    url.searchParams.append("refresh", initialRefresh);
  }

  if (dashboardConfig.orgId) {
    url.searchParams.append("orgId", dashboardConfig.orgId.toString());
  }

  const theme =
    dashboardConfig.theme || (resolvedTheme === "dark" ? "dark" : "light");
  url.searchParams.append("theme", theme);

  if (dashboardConfig.timezone) {
    url.searchParams.append("timezone", dashboardConfig.timezone);
  }

  if (dashboardConfig.variables) {
    for (const [key, value] of Object.entries(dashboardConfig.variables)) {
      url.searchParams.append(`var-${key}`, value);
    }
  }

  let result = `${url.toString()}&kiosk`;
  if (hideVariables) {
    result += "&_dash.hideVariables=true";
  }
  if (hideTimePicker) {
    result += "&_dash.hideTimePicker=true";
  }
  return result;
}
