import {
  type GrafanaDashboardConfig,
  buildGrafanaDashboardUrl,
} from "@/foundation/lib/grafana-dashboard-url";
import { useTheme } from "next-themes";
import { useCallback, useMemo, useRef } from "react";

const DEFAULT_GRAFANA_CSS = `
  body { background-color: pink; }
`;

export type { GrafanaDashboardConfig };

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
    if (!iframeRef.current) return;

    const cssToInject = customCSS
      ? `${DEFAULT_GRAFANA_CSS}\n${customCSS}`
      : DEFAULT_GRAFANA_CSS;

    try {
      const iframeDoc = iframeRef.current.contentDocument;
      if (iframeDoc) {
        const style = iframeDoc.createElement("style");
        style.textContent = cssToInject;
        iframeDoc.head.appendChild(style);
      }
    } catch (_) {
      // Cross-origin iframe — CSS injection not possible
    }
  }, [customCSS]);

  const dashboardUrl = useMemo(
    () =>
      buildGrafanaDashboardUrl({
        dashboardConfig,
        resolvedTheme,
        initialFrom,
        initialTo,
        initialRefresh,
        hideVariables,
        hideTimePicker,
      }),
    [
      dashboardConfig,
      resolvedTheme,
      initialFrom,
      initialTo,
      initialRefresh,
      hideVariables,
      hideTimePicker,
    ],
  );

  return (
    <iframe
      ref={iframeRef}
      src={dashboardUrl}
      className={`w-full border-0 ${className || ""}`}
      title={`Grafana Dashboard ${dashboardConfig.dashboardId}`}
      onLoad={handleIframeLoad}
    />
  );
}
