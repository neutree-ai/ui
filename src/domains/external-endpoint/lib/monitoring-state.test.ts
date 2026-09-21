import { describe, expect, it } from "vitest";
import { getModelRoutingDashboardProps } from "@/foundation/lib/grafana-dashboard-configs";
import { buildGrafanaDashboardUrl } from "@/foundation/lib/grafana-dashboard-url";
import { readMonitoringState } from "./monitoring-state";

describe("monitoring navigation context", () => {
  it("preserves a deleted model without replacing it with the first current model", () => {
    const state = readMonitoringState(
      new URLSearchParams("model=deleted&from=1000&to=2000"),
    );
    expect(state.models).toEqual(["deleted"]);
    expect(state.refresh).toBe("");
    expect(state.absolute).toBe(true);
  });
  it("defaults to all models without reserving a real model name", () => {
    expect(readMonitoringState(new URLSearchParams()).models).toEqual([]);
    expect(
      readMonitoringState(new URLSearchParams("model=all")).models,
    ).toEqual(["all"]);
    const props = getModelRoutingDashboardProps("https://grafana.example", {
      workspace: "default",
      endpoint: "ee",
      models: [],
      mode: "all",
      from: "now-1h",
      to: "now",
      refresh: "30s",
    });
    expect(
      new URL(buildGrafanaDashboardUrl(props)).searchParams.get("var-model"),
    ).toBe("$__all");
  });
  it("rejects reversed absolute ranges and unsupported modes", () => {
    expect(
      readMonitoringState(
        new URLSearchParams("from=2000&to=1000&mode=arbitrary"),
      ),
    ).toMatchObject({ from: "now-1h", to: "now", mode: "all", models: [] });
  });
  it("round trips Unicode and query metacharacters into an exact dashboard scope", () => {
    const model = '中文"\\.+&model=other';
    const props = getModelRoutingDashboardProps("https://grafana.example", {
      workspace: "default",
      endpoint: "ee",
      models: [model],
      mode: "all",
      from: "1000",
      to: "2000",
      refresh: "",
    });
    const url = new URL(buildGrafanaDashboardUrl(props));
    expect(url.searchParams.getAll("var-model")).toEqual([model]);
    expect(url.searchParams.get("var-endpoint_literal")).toBe(
      JSON.stringify("/workspace/default/external-endpoint/ee"),
    );
    expect(url.searchParams.get("var-mode")).toBe("stream|non_stream|unknown");
    expect(url.searchParams.has("refresh")).toBe(false);
    expect(url.searchParams.has("_dash.hideTimePicker")).toBe(false);
    expect(url.searchParams.has("_dash.hideVariables")).toBe(false);
  });
  it("preserves multiple exact models, including historical names and regex characters", () => {
    const params = new URLSearchParams("model=a.b&model=c|d&model=a.b&model=");
    const models = readMonitoringState(params).models;
    expect(models).toEqual(["a.b", "c|d"]);
    const props = getModelRoutingDashboardProps("https://grafana.example", {
      workspace: "default",
      endpoint: "ee",
      models,
      mode: "all",
      from: "now-1h",
      to: "now",
      refresh: "30s",
    });
    expect(
      new URL(buildGrafanaDashboardUrl(props)).searchParams.getAll("var-model"),
    ).toEqual(["a.b", "c|d"]);
  });
});
