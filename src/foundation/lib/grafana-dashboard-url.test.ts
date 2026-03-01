import { describe, expect, it } from "vitest";
import {
  type GrafanaDashboardUrlOptions,
  buildGrafanaDashboardUrl,
} from "./grafana-dashboard-url";

const baseConfig: GrafanaDashboardUrlOptions = {
  dashboardConfig: {
    baseUrl: "https://grafana.example.com",
    dashboardId: "abc123",
  },
};

describe("buildGrafanaDashboardUrl", () => {
  it("builds basic URL with defaults", () => {
    const url = buildGrafanaDashboardUrl(baseConfig);

    expect(url).toContain("/d/abc123");
    expect(url).toContain("from=now-1h");
    expect(url).toContain("to=now");
    expect(url).toContain("refresh=30s");
    expect(url).toContain("theme=light");
    expect(url).toContain("&kiosk");
  });

  it("uses dark theme when resolvedTheme is dark", () => {
    const url = buildGrafanaDashboardUrl({
      ...baseConfig,
      resolvedTheme: "dark",
    });

    expect(url).toContain("theme=dark");
  });

  it("prefers config theme over resolvedTheme", () => {
    const url = buildGrafanaDashboardUrl({
      ...baseConfig,
      dashboardConfig: {
        ...baseConfig.dashboardConfig,
        theme: "light",
      },
      resolvedTheme: "dark",
    });

    expect(url).toContain("theme=light");
  });

  it("includes orgId when set", () => {
    const url = buildGrafanaDashboardUrl({
      ...baseConfig,
      dashboardConfig: {
        ...baseConfig.dashboardConfig,
        orgId: 5,
      },
    });

    expect(url).toContain("orgId=5");
  });

  it("includes timezone when set", () => {
    const url = buildGrafanaDashboardUrl({
      ...baseConfig,
      dashboardConfig: {
        ...baseConfig.dashboardConfig,
        timezone: "browser",
      },
    });

    expect(url).toContain("timezone=browser");
  });

  it("includes variables with var- prefix", () => {
    const url = buildGrafanaDashboardUrl({
      ...baseConfig,
      dashboardConfig: {
        ...baseConfig.dashboardConfig,
        variables: { Cluster: "my-cluster", Instance: "$__all" },
      },
    });

    expect(url).toContain("var-Cluster=my-cluster");
    expect(url).toContain("var-Instance=%24__all");
  });

  it("uses custom from/to/refresh", () => {
    const url = buildGrafanaDashboardUrl({
      ...baseConfig,
      initialFrom: "now-6h",
      initialTo: "now-1h",
      initialRefresh: "10s",
    });

    expect(url).toContain("from=now-6h");
    expect(url).toContain("to=now-1h");
    expect(url).toContain("refresh=10s");
  });

  it("appends hideVariables flag", () => {
    const url = buildGrafanaDashboardUrl({
      ...baseConfig,
      hideVariables: true,
    });

    expect(url).toContain("_dash.hideVariables=true");
  });

  it("appends hideTimePicker flag", () => {
    const url = buildGrafanaDashboardUrl({
      ...baseConfig,
      hideTimePicker: true,
    });

    expect(url).toContain("_dash.hideTimePicker=true");
  });

  it("omits refresh param when empty string", () => {
    const url = buildGrafanaDashboardUrl({
      ...baseConfig,
      initialRefresh: "",
    });

    expect(url).not.toContain("refresh=");
  });
});
