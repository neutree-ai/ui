import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildGrafanaDashboardUrl,
  type GrafanaDashboardConfig,
} from "@/foundation/lib/grafana-dashboard-url";

const DEFAULT_GRAFANA_CSS = `
  /* The dashboard provides its own theme CSS, so no background override is injected here. */
`;

const GRAFANA_THEME_MARKER = "Grafana Custom Theme";
const GRAFANA_THEME_VARIABLE_MARKER = "--ui-bg";
const GRAFANA_THEME_READY_POLL_MS = 40;
const GRAFANA_THEME_READY_MAX_WAIT_MS = 8000;

interface GrafanaIframeProps {
  dashboardUrl: string;
  dashboardTitle: string;
  className?: string;
  customCSS?: string;
}

function GrafanaIframe({
  dashboardUrl,
  dashboardTitle,
  className,
  customCSS,
}: GrafanaIframeProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const iframeLoadedRef = useRef(false);
  const [isReady, setIsReady] = useState(false);

  const isThemeApplied = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return false;

    try {
      const iframeDoc = iframe.contentDocument;
      if (!iframeDoc) return false;

      return Array.from(iframeDoc.querySelectorAll("style")).some(
        (style) =>
          style.textContent.includes(GRAFANA_THEME_MARKER) ||
          style.textContent.includes(GRAFANA_THEME_VARIABLE_MARKER),
      );
    } catch {
      // Cross-origin iframe cannot be inspected; reveal on the load path.
      return iframeLoadedRef.current;
    }
  }, []);

  useEffect(() => {
    let timer: number | undefined;
    const startedAt = Date.now();

    const pollForTheme = () => {
      if (
        isThemeApplied() ||
        Date.now() - startedAt >= GRAFANA_THEME_READY_MAX_WAIT_MS
      ) {
        setIsReady(true);
        return;
      }
      timer = window.setTimeout(pollForTheme, GRAFANA_THEME_READY_POLL_MS);
    };

    timer = window.setTimeout(pollForTheme, 0);
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [isThemeApplied]);

  const handleIframeLoad = useCallback(() => {
    iframeLoadedRef.current = true;
    const iframe = iframeRef.current;
    if (!iframe) return;

    const cssToInject = customCSS
      ? `${DEFAULT_GRAFANA_CSS}\n${customCSS}`
      : DEFAULT_GRAFANA_CSS;

    try {
      const iframeDoc = iframe.contentDocument;
      if (iframeDoc) {
        const style = iframeDoc.createElement("style");
        style.textContent = cssToInject;
        iframeDoc.head.appendChild(style);
      }
    } catch {
      // Cross-origin iframe — CSS injection not possible.
    }
  }, [customCSS]);

  return (
    <iframe
      ref={iframeRef}
      src={dashboardUrl}
      className={`w-full border-0 transition-opacity duration-150 ${className || ""}`}
      style={{
        opacity: isReady ? 1 : 0,
        visibility: isReady ? "visible" : "hidden",
      }}
      title={dashboardTitle}
      onLoad={handleIframeLoad}
    />
  );
}

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
    <GrafanaIframe
      key={dashboardUrl}
      dashboardUrl={dashboardUrl}
      dashboardTitle={`Grafana Dashboard ${dashboardConfig.dashboardId}`}
      className={className}
      customCSS={customCSS}
    />
  );
}
