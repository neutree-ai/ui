import { matchResourceFromRoute } from "@refinedev/core";
import { describe, expect, it } from "vitest";
import { resources } from "./App";

const logSinks = () => {
  const resource = resources.find((r) => r.name === "log_sinks");
  if (!resource) throw new Error("log_sinks resource missing");
  return resource;
};

describe("Log Forwarding resource", () => {
  it("stays a resource for data access but is kept out of the menu", () => {
    expect(logSinks().meta).toMatchObject({ hide: true, parent: "ai_traces" });
  });

  it("lives under the Access Log routes", () => {
    expect(logSinks()).toMatchObject({
      list: "/ai-traces/log-sinks",
      create: "/ai-traces/log-sinks/create",
      edit: "/ai-traces/log-sinks/edit/:id",
      show: "/ai-traces/log-sinks/show/:id",
    });
  });

  it.each([
    ["/ai-traces/log-sinks", "list"],
    ["/ai-traces/log-sinks/create", "create"],
    ["/ai-traces/log-sinks/edit/3", "edit"],
    ["/ai-traces/log-sinks/show/3", "show"],
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
