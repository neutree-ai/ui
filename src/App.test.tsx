import { matchResourceFromRoute } from "@refinedev/core";
import { describe, expect, it } from "vitest";
import { resources } from "./App";

describe("Log Forwarding resource", () => {
  it.each([
    ["/log-forwarding", "list"],
    ["/log-forwarding/create", "create"],
    ["/log-forwarding/edit/3", "edit"],
    ["/log-forwarding/show/3", "show"],
  ])("resolves %s to the log_sinks %s page", (path, action) => {
    const match = matchResourceFromRoute(path, resources);
    expect(match.resource?.name).toBe("log_sinks");
    expect(match.action).toBe(action);
  });

  it("leaves the Access Log page itself to ai_traces", () => {
    const match = matchResourceFromRoute("/default/ai-traces", resources);
    expect(match.resource?.name).toBe("ai_traces");
  });
});
