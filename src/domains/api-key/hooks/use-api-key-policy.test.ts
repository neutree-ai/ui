import { describe, expect, it } from "vitest";
import {
  apiKeyPolicyDefaults,
  buildApiKeyPolicyParams,
  policyRowsToForm,
  summarizeApiKeyLimits,
} from "./use-api-key-policy";

describe("buildApiKeyPolicyParams", () => {
  it("emits no calls when all limits are empty", () => {
    const { quota, access } = buildApiKeyPolicyParams(
      apiKeyPolicyDefaults(),
      "k1",
    );
    expect(quota).toHaveLength(0);
    expect(access).toHaveLength(0);
  });

  it("emits a quota call only for a positive token limit", () => {
    const v = { ...apiKeyPolicyDefaults(), quota_period: "monthly" as const, quota_limit: "500000" };
    const { quota } = buildApiKeyPolicyParams(v, "k1");
    expect(quota).toEqual([
      {
        p_level: "api_key",
        p_api_key_id: "k1",
        p_period: "monthly",
        p_limit_tokens: 500000,
      },
    ]);
  });

  it("maps RPS to a per-second rate_limit, plus concurrency and allowed models", () => {
    const v = {
      ...apiKeyPolicyDefaults(),
      rps: "10",
      concurrency: "8",
      models: [{ value: "gpt-4o" }, { value: " " }, { value: "claude" }],
    };
    const { access } = buildApiKeyPolicyParams(v, "k1");
    expect(access).toContainEqual({
      p_level: "api_key",
      p_api_key_id: "k1",
      p_rule_type: "rate_limit",
      p_rule_spec: { limit: 10, window: "second" },
    });
    expect(access).toContainEqual({
      p_level: "api_key",
      p_api_key_id: "k1",
      p_rule_type: "concurrency",
      p_rule_spec: { max: 8 },
    });
    expect(access).toContainEqual({
      p_level: "api_key",
      p_api_key_id: "k1",
      p_rule_type: "model_allowlist",
      p_rule_spec: { models: ["gpt-4o", "claude"] },
    });
  });

  it("ignores zero / blank values", () => {
    const v = { ...apiKeyPolicyDefaults(), quota_limit: "0", rps: "", concurrency: "0" };
    const { quota, access } = buildApiKeyPolicyParams(v, "k1");
    expect(quota).toHaveLength(0);
    expect(access).toHaveLength(0);
  });
});

describe("policyRowsToForm", () => {
  it("maps current rows back into editable form values", () => {
    const v = policyRowsToForm(
      [{ id: 1, period: "monthly", limit_tokens: 500000, dimension_type: null }],
      [
        { id: 2, rule_type: "rate_limit", rule_spec: { limit: 10, window: "second" } },
        { id: 3, rule_type: "concurrency", rule_spec: { max: 8 } },
        { id: 4, rule_type: "model_allowlist", rule_spec: { models: ["gpt-4o"] } },
      ],
    );
    expect(v.quota_period).toBe("monthly");
    expect(v.quota_limit).toBe("500000");
    expect(v.rps).toBe("10");
    expect(v.concurrency).toBe("8");
    expect(v.models).toEqual([{ value: "gpt-4o" }]);
  });

  it("ignores dimension quota rows (only the overall quota prefills)", () => {
    const v = policyRowsToForm(
      [{ id: 9, period: "daily", limit_tokens: 100, dimension_type: "model" }],
      [],
    );
    expect(v.quota_limit).toBe("");
  });
});

describe("summarizeApiKeyLimits", () => {
  it("renders compact parts", () => {
    const parts = summarizeApiKeyLimits(
      [{ id: 1, period: "monthly", limit_tokens: 500000, dimension_type: null }],
      [
        { id: 2, rule_type: "rate_limit", rule_spec: { limit: 10, window: "second" } },
        { id: 3, rule_type: "concurrency", rule_spec: { max: 8 } },
        { id: 4, rule_type: "model_allowlist", rule_spec: { models: ["gpt-4o", "claude"] } },
      ],
    );
    expect(parts).toContain("500,000 tok/mo");
    expect(parts).toContain("10 RPS");
    expect(parts).toContain("8 concurrent");
    expect(parts).toContain("models: gpt-4o, claude");
  });
});
