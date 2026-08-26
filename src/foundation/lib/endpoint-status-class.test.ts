import { describe, expect, it } from "vitest";
import { endpointStatusClass } from "./endpoint-status-class";

describe("endpointStatusClass", () => {
  it.each([
    ["Running", "positive"],
    ["Failed", "serious"],
    ["Pending", "notice"],
    ["Deploying", "outstanding"],
    ["ModelDownloading", "outstanding"],
    ["Deleting", "notice"],
    ["Paused", "notice"],
    ["Deleted", "neutral"],
  ])("maps %s to its semantic status style", (phase, token) => {
    expect(endpointStatusClass(phase)).toContain(token);
  });

  it("returns no style for an absent or unknown phase", () => {
    expect(endpointStatusClass()).toBeUndefined();
    expect(endpointStatusClass("Unknown")).toBeUndefined();
  });
});
