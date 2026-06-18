import { describe, expect, it } from "vitest";
import {
  type ApiKeyLimits,
  apiKeyPolicyDefaults,
  buildApiKeyLimits,
  limitsToForm,
  rateSummary,
  summarizeApiKeyLimits,
} from "./use-api-key-policy";

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
    expect(buildApiKeyLimits(apiKeyPolicyDefaults(), { disabled: true })).toEqual(
      { disabled: true },
    );
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
    expect(limitsToForm({ token_quota: { limit: 0, period: "daily" } }).quota_limit).toBe(
      "",
    );
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
