import { describe, expect, it } from "vitest";
import type { ApiKeyLimits } from "@/domains/api-key/types";
import {
  apiKeyPolicyDefaults,
  buildApiKeyLimits,
  compareWorkspaceModelOptions,
  isPositiveIntLimit,
  limitsToForm,
  rateSummary,
  summarizeApiKeyLimits,
  type WorkspaceModelOption,
} from "./use-api-key-policy";

describe("isPositiveIntLimit", () => {
  it("treats empty / whitespace as valid (optional, unset)", () => {
    expect(isPositiveIntLimit("")).toBe(true);
    expect(isPositiveIntLimit("   ")).toBe(true);
  });

  it("accepts positive integers", () => {
    expect(isPositiveIntLimit("1")).toBe(true);
    expect(isPositiveIntLimit("500000")).toBe(true);
  });

  it("rejects zero, negatives, decimals and non-numeric input", () => {
    expect(isPositiveIntLimit("0")).toBe(false);
    expect(isPositiveIntLimit("-1")).toBe(false);
    expect(isPositiveIntLimit("1.5")).toBe(false);
    expect(isPositiveIntLimit("abc")).toBe(false);
  });
});

describe("buildApiKeyLimits", () => {
  it("emits an empty object when all limits are empty", () => {
    expect(buildApiKeyLimits(apiKeyPolicyDefaults())).toEqual({});
  });

  it("emits token_quota only for a positive token limit", () => {
    const v = {
      ...apiKeyPolicyDefaults(),
      quota_period: "monthly" as const,
      quota_limit: "500000",
    };
    expect(buildApiKeyLimits(v)).toEqual({
      token_quota: { limit: 500000, period: "monthly" },
    });
  });

  it("maps RPS / RPM / concurrency and trims blank allowed models", () => {
    const v = {
      ...apiKeyPolicyDefaults(),
      rps: "10",
      rpm: "600",
      concurrency: "8",
      models: [{ value: "gpt-4o" }, { value: " " }, { value: "claude" }],
    };
    expect(buildApiKeyLimits(v)).toEqual({
      rps: 10,
      rpm: 600,
      concurrency: 8,
      allowed_models: ["gpt-4o", "claude"],
    });
  });

  it("stores endpoint-level selections as unique model names", () => {
    const v = {
      ...apiKeyPolicyDefaults(),
      models: [
        { value: "internal:chat-a:gpt-4o", model: "gpt-4o" },
        { value: "external:openrouter:gpt-4o", model: "gpt-4o" },
        { value: "external:anthropic:claude", model: "claude" },
      ],
    };
    expect(buildApiKeyLimits(v)).toEqual({
      allowed_models: ["gpt-4o", "claude"],
    });
  });

  it("ignores zero / blank values", () => {
    const v = {
      ...apiKeyPolicyDefaults(),
      quota_limit: "0",
      rps: "",
      concurrency: "0",
    };
    expect(buildApiKeyLimits(v)).toEqual({});
  });

  it("carries the disabled flag when asked", () => {
    expect(
      buildApiKeyLimits(apiKeyPolicyDefaults(), { disabled: true }),
    ).toEqual({ disabled: true });
    expect(
      buildApiKeyLimits(apiKeyPolicyDefaults(), { disabled: false }),
    ).toEqual({});
  });
});

describe("limitsToForm", () => {
  it("maps a stored limits object back into editable form values", () => {
    const limits: ApiKeyLimits = {
      token_quota: { limit: 500000, period: "monthly" },
      rps: 10,
      concurrency: 8,
      allowed_models: ["gpt-4o"],
    };
    const v = limitsToForm(limits);
    expect(v.quota_period).toBe("monthly");
    expect(v.quota_limit).toBe("500000");
    expect(v.rps).toBe("10");
    expect(v.concurrency).toBe("8");
    expect(v.models).toEqual([{ value: "gpt-4o" }]);
  });

  it("returns defaults for null / empty limits", () => {
    expect(limitsToForm(null)).toEqual(apiKeyPolicyDefaults());
    expect(limitsToForm({})).toEqual(apiKeyPolicyDefaults());
  });

  it("ignores a non-positive token quota", () => {
    expect(
      limitsToForm({ token_quota: { limit: 0, period: "daily" } }).quota_limit,
    ).toBe("");
  });

  it("falls back to the default period for an unknown / empty period", () => {
    expect(
      limitsToForm({ token_quota: { limit: 100, period: "fortnightly" } })
        .quota_period,
    ).toBe("monthly");
    expect(
      limitsToForm({ token_quota: { limit: 100, period: "" } }).quota_period,
    ).toBe("monthly");
  });
});

describe("summarizeApiKeyLimits", () => {
  it("renders compact parts", () => {
    const parts = summarizeApiKeyLimits({
      token_quota: { limit: 500000, period: "monthly" },
      rps: 10,
      concurrency: 8,
      allowed_models: ["gpt-4o", "claude"],
    });
    expect(parts).toContain("500,000 tok/mo");
    expect(parts).toContain("10 RPS");
    expect(parts).toContain("8 concurrent");
    expect(parts).toContain("models: gpt-4o, claude");
  });

  it("caps the inline model list at 3 with a +N suffix", () => {
    const parts = summarizeApiKeyLimits({
      allowed_models: ["a", "b", "c", "d", "e"],
    });
    expect(parts).toContain("models: a, b, c +2");
  });

  it("is empty for no limits", () => {
    expect(summarizeApiKeyLimits(null)).toEqual([]);
    expect(summarizeApiKeyLimits({})).toEqual([]);
  });
});

describe("rateSummary", () => {
  it("includes only rate / concurrency parts", () => {
    const parts = rateSummary({
      token_quota: { limit: 1, period: "daily" },
      rps: 10,
      rpm: 600,
      concurrency: 8,
      allowed_models: ["gpt-4o"],
    });
    expect(parts).toEqual(["10 RPS", "600 RPM", "8 concurrent"]);
  });
});

describe("compareWorkspaceModelOptions", () => {
  const opt = (
    over: Partial<WorkspaceModelOption> &
      Pick<WorkspaceModelOption, "model" | "endpointName">,
  ): WorkspaceModelOption => ({
    value: `${over.model}:${over.endpointName}`,
    label: over.model,
    type: "internal",
    phase: null,
    ...over,
  });

  it("orders Running endpoints before non-running ones", () => {
    const paused = opt({ model: "a", endpointName: "e1", phase: "Paused" });
    const running = opt({ model: "z", endpointName: "e2", phase: "Running" });
    expect([paused, running].sort(compareWorkspaceModelOptions)).toEqual([
      running,
      paused,
    ]);
  });

  it("falls back to model, endpoint, then type within the same group", () => {
    const a = opt({ model: "alpha", endpointName: "e2", phase: "Running" });
    const b = opt({ model: "alpha", endpointName: "e1", phase: "Running" });
    const c = opt({ model: "beta", endpointName: "e1", phase: "Running" });
    expect([c, a, b].sort(compareWorkspaceModelOptions)).toEqual([b, a, c]);
  });
});
