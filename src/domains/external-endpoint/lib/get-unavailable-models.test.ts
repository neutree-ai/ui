import { describe, expect, it } from "vitest";
import type { UpstreamStatus } from "../types";
import { getUnavailableModels } from "./get-unavailable-models";

const ready: UpstreamStatus = {
  ref: "https://ok.example.com",
  phase: "Ready",
  models: ["healthy"],
};

describe("getUnavailableModels", () => {
  it("collects the models of failed upstreams only", () => {
    const failed: UpstreamStatus = {
      ref: "missing",
      phase: "Failed",
      models: ["broken-a", "broken-b"],
    };

    expect(getUnavailableModels([failed, ready])).toEqual(
      new Set(["broken-a", "broken-b"]),
    );
  });

  it("keeps a model callable while its backup is ready", () => {
    const primary: UpstreamStatus = {
      ref: "primary",
      phase: "Failed",
      models: ["chat", "embedding"],
    };
    const backup: UpstreamStatus = {
      ref: "backup",
      phase: "Ready",
      models: ["chat"],
    };
    expect(getUnavailableModels([primary, backup])).toEqual(
      new Set(["embedding"]),
    );
    expect(
      getUnavailableModels([primary, { ...backup, phase: "Failed" }]),
    ).toEqual(new Set(["chat", "embedding"]));
  });

  it("is empty when nothing failed or nothing is known", () => {
    expect(getUnavailableModels([ready])).toEqual(new Set());
    expect(getUnavailableModels([null, null])).toEqual(new Set());
    expect(getUnavailableModels([])).toEqual(new Set());
  });

  it("tolerates a failed upstream that reports no models", () => {
    expect(getUnavailableModels([{ ref: "x", phase: "Failed" }])).toEqual(
      new Set(),
    );
  });
});
