import { describe, expect, it } from "vitest";
import { getUpstreamModelRequest } from "./get-upstream-model-request";

const base = { model_mapping: {}, models: null };
describe("upstream model request", () => {
  it("does not query incomplete channels", () => {
    expect(getUpstreamModelRequest(undefined, "default")).toBeUndefined();
    expect(
      getUpstreamModelRequest({ ...base, upstream: { url: " " } }, "default"),
    ).toBeUndefined();
  });
  it("uses internal endpoint identity without external credentials", () => {
    expect(
      getUpstreamModelRequest(
        {
          ...base,
          endpoint_ref: "internal",
          auth: { type: "bearer", credential: "unused" },
        },
        "workspace-a",
      ),
    ).toEqual({ endpoint_ref: "internal", workspace: "workspace-a" });
  });
  it("uses current external URL and credential for unsaved channels", () => {
    expect(
      getUpstreamModelRequest(
        {
          ...base,
          upstream: { url: " https://example.com/v1 " },
          auth: { type: "bearer", credential: "new-token" },
        },
        "default",
      ),
    ).toEqual({
      upstream: { url: "https://example.com/v1" },
      auth: { type: "bearer", credential: "new-token" },
      workspace: "default",
    });
  });
  it("passes the original URL so saved credentials survive a URL edit", () => {
    expect(
      getUpstreamModelRequest(
        { ...base, upstream: { url: "https://new.example/v1" } },
        "default",
        { name: "gateway", url: "https://old.example/v1" },
      ),
    ).toEqual({
      upstream: { url: "https://new.example/v1" },
      auth: { type: "bearer", credential: "" },
      workspace: "default",
      name: "gateway",
      stored_upstream_url: "https://old.example/v1",
    });
  });
});
