import { describe, expect, it } from "vitest";
import {
  apiKeyPolicyDefaults,
  buildApiKeyPolicyParams,
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

  it("emits a quota call only when a positive token limit is set", () => {
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

  it("ignores zero / blank limits", () => {
    const v = { ...apiKeyPolicyDefaults(), quota_limit: "0", rate_limit: "", concurrency: "0" };
    const { quota, access } = buildApiKeyPolicyParams(v, "k1");
    expect(quota).toHaveLength(0);
    expect(access).toHaveLength(0);
  });

  it("builds rate_limit, concurrency, model_allowlist and endpoint_allowlist access calls", () => {
    const v = {
      ...apiKeyPolicyDefaults(),
      rate_limit: "600",
      rate_window: "minute" as const,
      concurrency: "8",
      models: [{ value: "gpt-4o" }, { value: " " }, { value: "claude" }],
      endpoints: [
        { type: "endpoint" as const, name: "ep-a" },
        { type: "external_endpoint" as const, name: "" },
      ],
    };
    const { access } = buildApiKeyPolicyParams(v, "k1");
    expect(access).toContainEqual({
      p_level: "api_key",
      p_api_key_id: "k1",
      p_rule_type: "rate_limit",
      p_rule_spec: { limit: 600, window: "minute" },
    });
    expect(access).toContainEqual({
      p_level: "api_key",
      p_api_key_id: "k1",
      p_rule_type: "concurrency",
      p_rule_spec: { max: 8 },
    });
    // blank model dropped
    expect(access).toContainEqual({
      p_level: "api_key",
      p_api_key_id: "k1",
      p_rule_type: "model_allowlist",
      p_rule_spec: { models: ["gpt-4o", "claude"] },
    });
    // endpoint with empty name dropped
    expect(access).toContainEqual({
      p_level: "api_key",
      p_api_key_id: "k1",
      p_rule_type: "endpoint_allowlist",
      p_rule_spec: { endpoints: [{ type: "endpoint", name: "ep-a" }] },
    });
  });
});
