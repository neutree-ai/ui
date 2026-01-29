import { useTheme } from "next-themes";
import { useCallback, useMemo, useRef } from "react";

const DEFAULT_GRAFANA_CSS = `
  body { background-color: pink; }
`;

export interface GrafanaDashboardConfig {
  baseUrl: string;
  dashboardId: string;
  orgId?: number;
  theme?: "light" | "dark";
  timezone?: string;
  variables?: Record<string, string>;
}

export interface GrafanaDashboardProps {
  dashboardConfig: GrafanaDashboardConfig;
  initialFrom?: string;
  initialTo?: string;
  initialRefresh?: string;
  hideVariables?: boolean;
  hideTimePicker?: boolean;
  className?: string;
  /** Custom CSS to inject into the iframe (only works for same-origin) */
  customCSS?: string;
}

export default function GrafanaDashboard({
  dashboardConfig,
  initialFrom = "now-1h",
  initialTo = "now",
  initialRefresh = "30s",
  hideVariables = false,
  hideTimePicker = false,
  className,
  customCSS,
}: GrafanaDashboardProps) {
  const { resolvedTheme } = useTheme();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleIframeLoad = useCallback(() => {
    console.log("[GrafanaDashboard] iframe loaded");
    if (!iframeRef.current) {
      console.log("[GrafanaDashboard] iframeRef is null");
      return;
    }

    const cssToInject = customCSS
      ? `${DEFAULT_GRAFANA_CSS}\n${customCSS}`
      : DEFAULT_GRAFANA_CSS;

    try {
      const iframeDoc = iframeRef.current.contentDocument;
      console.log("[GrafanaDashboard] contentDocument:", iframeDoc);
      if (iframeDoc) {
        const style = iframeDoc.createElement("style");
        style.textContent = cssToInject;
        iframeDoc.head.appendChild(style);
        console.log("[GrafanaDashboard] CSS injected successfully");
      }
    } catch (e) {
      console.log("[GrafanaDashboard] CSS injection failed (cross-origin):", e);
    }
  }, [customCSS]);

  const dashboardUrl = useMemo(() => {
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
  }, [
    dashboardConfig,
    initialFrom,
    initialTo,
    initialRefresh,
    resolvedTheme,
    hideVariables,
    hideTimePicker,
  ]);

  return (
    <iframe
      ref={iframeRef}
      src={dashboardUrl}
      className={`w-full border-0 ${className || ""}`}
      style={{ minHeight: "600px" }}
      title={`Grafana Dashboard ${dashboardConfig.dashboardId}`}
      onLoad={handleIframeLoad}
    />
  );
}
