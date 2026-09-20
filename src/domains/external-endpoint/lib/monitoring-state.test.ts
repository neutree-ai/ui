import { describe, expect, it } from "vitest";
import { getModelRoutingDashboardProps } from "@/foundation/lib/grafana-dashboard-configs";
import { buildGrafanaDashboardUrl } from "@/foundation/lib/grafana-dashboard-url";
import { readMonitoringState } from "./monitoring-state";

describe("monitoring navigation context", () => {
  it("preserves a deleted model without replacing it with the first current model", () => {
    const state = readMonitoringState(
      new URLSearchParams("model=deleted&from=1000&to=2000"),
      ["new"],
    );
    expect(state.model).toBe("deleted");
    expect(state.refresh).toBe("");
    expect(state.absolute).toBe(true);
  });
  it("rejects reversed absolute ranges and unsupported modes", () => {
    expect(
      readMonitoringState(
        new URLSearchParams("from=2000&to=1000&mode=arbitrary"),
        ["chat"],
      ),
    ).toMatchObject({ from: "now-1h", to: "now", mode: "all", model: "chat" });
  });
  it("round trips Unicode and query metacharacters into an exact dashboard scope", () => {
    const model = '中文"\\.+&model=other';
    const props = getModelRoutingDashboardProps("https://grafana.example", {
      workspace: "default",
      endpoint: "ee",
      model,
      mode: "all",
      from: "1000",
      to: "2000",
      refresh: "",
    });
    const url = new URL(buildGrafanaDashboardUrl(props));
    expect(url.searchParams.getAll("var-model_literal")).toEqual([
      JSON.stringify(model),
    ]);
    expect(url.searchParams.get("var-endpoint_literal")).toBe(
      JSON.stringify("/workspace/default/external-endpoint/ee"),
    );
    expect(url.searchParams.get("var-mode")).toBe("stream|non_stream|unknown");
    expect(url.searchParams.has("refresh")).toBe(false);
    expect(url.searchParams.get("_dash.hideTimePicker")).toBe("true");
  });
});
