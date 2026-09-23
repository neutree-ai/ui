import { describe, expect, it } from "vitest";
import type { ApiKeyLimits } from "@/domains/api-key/types";
import { SELF_HOSTED_MODEL_SOURCE } from "@/foundation/lib/model-source";
import { DEFAULT_TOKEN_QUOTA_UNIT } from "@/foundation/lib/token-quota";
import {
  apiKeyPolicyDefaults,
  buildApiKeyLimits,
  compareWorkspaceModelOptions,
  formQuotaGranularity,
  isPositiveIntLimit,
  limitsToForm,
  modelRowTokenLimit,
  overlappingModelRowValues,
  type PolicyModelRow,
  rateSummary,
  resolveQuotaPeriod,
  type WorkspaceModelOption,
} from "./use-api-key-policy";

const row = (over: Partial<PolicyModelRow>): PolicyModelRow => ({
  value: `${over.type ?? ""}:${over.endpoint_name ?? ""}:${over.model ?? "m"}`,
  model: "m",
  ...over,
});

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
      quota_limit: "500,000",
      quota_unit: "tokens" as const,
    };
    expect(buildApiKeyLimits(v)).toEqual({
      token_quota: { limit: 500000, period: "monthly" },
    });
  });

  it("multiplies the amount by the selected unit", () => {
    const build = (quota_limit: string, quota_unit: "K" | "M" | "B") =>
      buildApiKeyLimits({ ...apiKeyPolicyDefaults(), quota_limit, quota_unit })
        .token_quota?.limit;
    expect(build("200", "M")).toBe(200_000_000);
    expect(build("1.5", "M")).toBe(1_500_000);
    expect(build("2", "B")).toBe(2_000_000_000);
    expect(build("10", "K")).toBe(10_000);
  });

  it("drops a quota whose amount does not resolve to whole tokens", () => {
    const v = {
      ...apiKeyPolicyDefaults(),
      quota_limit: "1.5",
      quota_unit: "tokens" as const,
    };
    expect(buildApiKeyLimits(v)).toEqual({});
  });

  it("maps RPS / RPM / concurrency and drops rows with a blank model", () => {
    const v = {
      ...apiKeyPolicyDefaults(),
      rps: "10",
      rpm: "600",
      concurrency: "8",
      models: [
        {
          value: "external:ee-a:gpt-4o",
          model: "gpt-4o",
          type: "external" as const,
          endpoint_name: "ee-a",
        },
        { value: " ", model: " " },
      ],
    };
    expect(buildApiKeyLimits(v)).toEqual({
      rps: 10,
      rpm: 600,
      concurrency: 8,
      allowed_models: [
        { model: "gpt-4o", type: "external", endpoint_name: "ee-a" },
      ],
    });
  });

  it("keeps endpoint-scoped selections distinct (same model, different endpoints)", () => {
    const v = {
      ...apiKeyPolicyDefaults(),
      models: [
        {
          value: "internal:chat-a:gpt-4o",
          model: "gpt-4o",
          type: "internal" as const,
          endpoint_name: "chat-a",
        },
        {
          value: "external:openrouter:gpt-4o",
          model: "gpt-4o",
          type: "external" as const,
          endpoint_name: "openrouter",
        },
        {
          value: "external:anthropic:claude",
          model: "claude",
          type: "external" as const,
          endpoint_name: "anthropic",
        },
      ],
    };
    expect(buildApiKeyLimits(v)).toEqual({
      allowed_models: [
        { model: "gpt-4o", type: "internal", endpoint_name: "chat-a" },
        { model: "gpt-4o", type: "external", endpoint_name: "openrouter" },
        { model: "claude", type: "external", endpoint_name: "anthropic" },
      ],
    });
  });

  it("passes wildcard (any-source) rows through and dedups them", () => {
    const v = {
      ...apiKeyPolicyDefaults(),
      models: [
        { value: "gpt-4o", model: "gpt-4o", wildcard: true },
        { value: "gpt-4o", model: "gpt-4o", wildcard: true },
      ],
    };
    expect(buildApiKeyLimits(v)).toEqual({
      allowed_models: [{ model: "gpt-4o" }],
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
  it("round-trips a token quota through the form without losing precision", () => {
    for (const limit of [1, 12_345, 10_000, 1_500_000, 200_000_000]) {
      const v = limitsToForm({ token_quota: { limit, period: "monthly" } });
      expect(buildApiKeyLimits(v).token_quota?.limit).toBe(limit);
    }
  });

  it("prefills an indivisible count as raw tokens", () => {
    const v = limitsToForm({ token_quota: { limit: 12_345, period: "daily" } });
    expect(v.quota_limit).toBe("12,345");
    expect(v.quota_unit).toBe("tokens");
  });

  it("maps a stored limits object back into editable form values", () => {
    const limits: ApiKeyLimits = {
      token_quota: { limit: 500000, period: "monthly" },
      rps: 10,
      concurrency: 8,
      allowed_models: [
        { model: "gpt-4o", type: "internal", endpoint_name: "chat-a" },
      ],
    };
    const v = limitsToForm(limits);
    expect(v.quota_period).toBe("monthly");
    // 500000 divides evenly into K, so it prefills as 500 K.
    expect(v.quota_limit).toBe("500");
    expect(v.quota_unit).toBe("K");
    expect(v.rps).toBe("10");
    expect(v.concurrency).toBe("8");
    expect(v.models).toEqual([
      {
        value: "internal:chat-a:gpt-4o",
        model: "gpt-4o",
        type: "internal",
        endpoint_name: "chat-a",
        limit_amount: "",
        limit_unit: DEFAULT_TOKEN_QUOTA_UNIT,
      },
    ]);
  });

  it("maps a legacy (any-source) entry to a read-only wildcard row", () => {
    const v = limitsToForm({ allowed_models: [{ model: "gpt-4o" }] });
    expect(v.models).toEqual([
      {
        value: "gpt-4o",
        model: "gpt-4o",
        wildcard: true,
        limit_amount: "",
        limit_unit: DEFAULT_TOKEN_QUOTA_UNIT,
      },
    ]);
  });

  it("prefills a per-model limit as amount + largest exact unit, with its usage", () => {
    const v = limitsToForm({
      allowed_models: [
        {
          model: "gpt-4o",
          type: "external",
          endpoint_name: "openai",
          token_limit: 2_000_000,
          used: 2_500_000,
          remaining: -500_000,
        },
      ],
    });
    expect(v.models).toEqual([
      {
        value: "external:openai:gpt-4o",
        model: "gpt-4o",
        type: "external",
        endpoint_name: "openai",
        limit_amount: "2",
        limit_unit: "M",
        used: 2_500_000,
        remaining: -500_000,
      },
    ]);
  });

  it("prefers the key-level quota_period over token_quota.period", () => {
    // In per-model mode token_quota may carry no period of its own, but the key
    // still has exactly one and get_api_key_limits echoes it as quota_period.
    expect(
      limitsToForm({
        token_quota: { limit: 1, period: "monthly" },
        quota_period: "weekly",
      }).quota_period,
    ).toBe("weekly");
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

describe("rateSummary", () => {
  it("includes only rate / concurrency parts", () => {
    const parts = rateSummary({
      token_quota: { limit: 1, period: "daily" },
      rps: 10,
      rpm: 600,
      concurrency: 8,
      allowed_models: [{ model: "gpt-4o" }],
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
    source: over.type === "external" ? undefined : SELF_HOSTED_MODEL_SOURCE,
    phase: null,
    ...over,
  });

  it("orders Running endpoints before non-running ones within a source", () => {
    const paused = opt({
      model: "a",
      endpointName: "e1",
      type: "external",
      source: "partner",
      phase: "Paused",
    });
    const running = opt({
      model: "z",
      endpointName: "e2",
      type: "external",
      source: "partner",
      phase: "Running",
    });
    expect([paused, running].sort(compareWorkspaceModelOptions)).toEqual([
      running,
      paused,
    ]);
  });

  it("ranks a Degraded external endpoint with the serving ones", () => {
    // Degraded means some upstream is unavailable but the endpoint still
    // serves, so its models stay near the top rather than sinking to Failed.
    const failed = opt({
      model: "a",
      endpointName: "e1",
      type: "external",
      phase: "Failed",
    });
    const degraded = opt({
      model: "z",
      endpointName: "e2",
      type: "external",
      phase: "Degraded",
    });
    expect([failed, degraded].sort(compareWorkspaceModelOptions)).toEqual([
      degraded,
      failed,
    ]);
  });

  it("groups internal before external within the same status", () => {
    // Internal endpoints are always self-hosted, the first preset source, so a
    // Running external model that sorts alphabetically before an internal one
    // must still land after every Running internal model.
    const extA = opt({
      model: "aaa",
      endpointName: "e1",
      type: "external",
      phase: "Running",
    });
    const intZ = opt({
      model: "zzz",
      endpointName: "e2",
      type: "internal",
      phase: "Running",
    });
    expect([extA, intZ].sort(compareWorkspaceModelOptions)).toEqual([
      intZ,
      extA,
    ]);
  });

  it("falls back to model then endpoint within the same status+type group", () => {
    const a = opt({
      model: "alpha",
      endpointName: "e2",
      type: "internal",
      phase: "Running",
    });
    const b = opt({
      model: "alpha",
      endpointName: "e1",
      type: "internal",
      phase: "Running",
    });
    const c = opt({
      model: "beta",
      endpointName: "e1",
      type: "internal",
      phase: "Running",
    });
    expect([c, a, b].sort(compareWorkspaceModelOptions)).toEqual([b, a, c]);
  });

  it("keeps each source contiguous, even across status", () => {
    // Source is the primary grouping so the picker can render one heading per
    // source: a stopped self-hosted model stays in the self-hosted section
    // rather than sinking below the running external ones. Status still
    // decides the order inside a section.
    const ie1 = opt({
      model: "ie-1",
      endpointName: "ie-1",
      type: "internal",
      phase: "Running",
    });
    const ie2 = opt({
      model: "ie-2",
      endpointName: "ie-2",
      type: "internal",
      phase: "Running",
    });
    const ee1 = opt({
      model: "ee-1",
      endpointName: "ee-1",
      type: "external",
      phase: "Running",
    });
    const ee2 = opt({
      model: "ee-2",
      endpointName: "ee-2",
      type: "external",
      phase: "Running",
    });
    const ie3 = opt({
      model: "ie-3",
      endpointName: "ie-3",
      type: "internal",
      phase: "Stopped",
    });
    expect(
      [ee2, ie3, ee1, ie2, ie1].sort(compareWorkspaceModelOptions),
    ).toEqual([ie1, ie2, ie3, ee1, ee2]);
  });

  it("orders sources by the preset list, unknown slugs then unlabelled last", () => {
    const selfHosted = opt({
      model: "m",
      endpointName: "ie",
      type: "internal",
    });
    const shared = opt({
      model: "m",
      endpointName: "ee-shared",
      type: "external",
      source: "internal-shared",
    });
    const custom = opt({
      model: "m",
      endpointName: "ee-custom",
      type: "external",
      source: "government-cloud",
    });
    const unlabelled = opt({
      model: "m",
      endpointName: "ee-plain",
      type: "external",
    });
    expect(
      [unlabelled, custom, shared, selfHosted].sort(
        compareWorkspaceModelOptions,
      ),
    ).toEqual([selfHosted, shared, custom, unlabelled]);
  });

  it("keeps the internal and external rows for one model name apart", () => {
    // The acceptance NEU-783 depends on: the same model name served by an
    // internal and an external endpoint stays two distinguishable rows, and
    // each keeps its own type + endpoint for the allowlist triple.
    const internal = opt({
      model: "qwen3",
      endpointName: "qwen-ie",
      type: "internal",
      phase: "Running",
    });
    const external = opt({
      model: "qwen3",
      endpointName: "qwen-ee",
      type: "external",
      source: "third-party-public",
      phase: "Running",
    });
    const sorted = [external, internal].sort(compareWorkspaceModelOptions);
    expect(sorted).toEqual([internal, external]);
    expect(sorted.map((o) => o.value)).toEqual([
      "qwen3:qwen-ie",
      "qwen3:qwen-ee",
    ]);
    expect(sorted[0]?.source).toBe(SELF_HOSTED_MODEL_SOURCE);
    expect(sorted[1]?.source).toBe("third-party-public");
  });
});

describe("modelRowTokenLimit", () => {
  it("multiplies amount by unit and treats an empty amount as no limit", () => {
    expect(
      modelRowTokenLimit(row({ limit_amount: "50", limit_unit: "M" })),
    ).toBe(50_000_000);
    expect(modelRowTokenLimit(row({ limit_amount: "", limit_unit: "M" }))).toBe(
      null,
    );
    expect(modelRowTokenLimit(row({}))).toBe(null);
  });

  it("rejects amounts that do not resolve to whole positive tokens", () => {
    // 0 is never "unlimited" and never "disabled" — the backend rejects it, so
    // it must not reach the wire as a token_limit.
    expect(
      modelRowTokenLimit(row({ limit_amount: "0", limit_unit: "M" })),
    ).toBe(null);
    expect(
      modelRowTokenLimit(row({ limit_amount: "1.5", limit_unit: "tokens" })),
    ).toBe(null);
  });
});

describe("formQuotaGranularity", () => {
  it("is overall until some row carries a limit, and again once they are cleared", () => {
    expect(formQuotaGranularity([])).toBe("overall");
    expect(formQuotaGranularity([row({ limit_amount: "" })])).toBe("overall");
    expect(formQuotaGranularity([row({ limit_amount: "50" })])).toBe(
      "per_model",
    );
  });

  it("reacts to an amount that is not yet valid", () => {
    // The intent to set a per-model limit is what suspends the overall quota;
    // waiting for the amount to become valid would flip the mode mid-typing.
    expect(formQuotaGranularity([row({ limit_amount: "1.5" })])).toBe(
      "per_model",
    );
  });
});

describe("overlappingModelRowValues", () => {
  const limited = { limit_amount: "50", limit_unit: "M" as const };

  it("flags a wildcard row against a pinned row of the same model", () => {
    const rows = [
      row({ model: "m", ...limited, type: "external", endpoint_name: "e1" }),
      row({ model: "m", wildcard: true }),
    ];
    expect([...overlappingModelRowValues(rows)]).toEqual([
      "external:e1:m",
      "::m",
    ]);
  });

  it("allows rows that disagree on a dimension both of them pin", () => {
    const rows = [
      row({ model: "m", ...limited, type: "internal", endpoint_name: "e1" }),
      row({ model: "m", type: "external", endpoint_name: "e2" }),
    ];
    expect(overlappingModelRowValues(rows).size).toBe(0);
  });

  it("ignores overlaps for a model where no row carries a limit", () => {
    // Migration 078 put legacy name-only entries in this shape; a key with no
    // per-model quota must keep editing cleanly.
    const rows = [
      row({ model: "m", wildcard: true }),
      row({ model: "m", type: "internal", endpoint_name: "e1" }),
    ];
    expect(overlappingModelRowValues(rows).size).toBe(0);
  });

  it("does not flag rows of different models", () => {
    const rows = [
      row({ model: "a", ...limited, type: "internal", endpoint_name: "e1" }),
      row({ model: "b", type: "internal", endpoint_name: "e1" }),
    ];
    expect(overlappingModelRowValues(rows).size).toBe(0);
  });
});

describe("resolveQuotaPeriod", () => {
  it("passes through a known period and falls back to monthly otherwise", () => {
    expect(resolveQuotaPeriod("weekly")).toBe("weekly");
    expect(resolveQuotaPeriod("fortnightly")).toBe("monthly");
    expect(resolveQuotaPeriod(null)).toBe("monthly");
    expect(resolveQuotaPeriod(undefined)).toBe("monthly");
  });
});

describe("buildApiKeyLimits per-model quota", () => {
  it("hangs the limit off the allowlist entry and omits it when unset", () => {
    const limits = buildApiKeyLimits({
      ...apiKeyPolicyDefaults(),
      models: [
        row({
          model: "gpt-4o",
          type: "external",
          endpoint_name: "openai",
          limit_amount: "2",
          limit_unit: "M",
        }),
        row({ model: "qwen", type: "internal", endpoint_name: "local" }),
      ],
    });
    expect(limits.allowed_models).toEqual([
      {
        model: "gpt-4o",
        type: "external",
        endpoint_name: "openai",
        token_limit: 2_000_000,
      },
      // Unlimited is the ABSENCE of token_limit, never 0.
      { model: "qwen", type: "internal", endpoint_name: "local" },
    ]);
  });

  it("keeps the overall quota on the wire while per-model limits are set", () => {
    // Mutual exclusion is enforced by the backend from the entries alone; the
    // overall quota is retained so clearing the entry limits falls back to it.
    const limits = buildApiKeyLimits({
      ...apiKeyPolicyDefaults(),
      quota_limit: "1",
      quota_unit: "M",
      models: [
        row({
          model: "gpt-4o",
          type: "external",
          endpoint_name: "openai",
          limit_amount: "2",
          limit_unit: "M",
        }),
      ],
    });
    expect(limits.token_quota).toEqual({ limit: 1_000_000, period: "monthly" });
  });

  it("carries a limit on a wildcard (any-source) entry", () => {
    const limits = buildApiKeyLimits({
      ...apiKeyPolicyDefaults(),
      models: [
        row({
          model: "gpt-4o",
          wildcard: true,
          limit_amount: "500",
          limit_unit: "K",
        }),
      ],
    });
    expect(limits.allowed_models).toEqual([
      { model: "gpt-4o", token_limit: 500_000 },
    ]);
  });
});

describe("per-model quota round trip", () => {
  it("persists the chosen period when there is no overall amount", () => {
    // The period lives on token_quota, which a per-model key has no amount for.
    // Emitting nothing here made the backend fall back to monthly, silently
    // discarding the user's choice.
    const limits = buildApiKeyLimits({
      ...apiKeyPolicyDefaults(),
      quota_period: "weekly",
      models: [row({ model: "gpt-4o", limit_amount: "500", limit_unit: "K" })],
    });
    expect(limits.token_quota).toEqual({ period: "weekly" });
  });

  it("does not invent a token_quota for a key with no limits at all", () => {
    const limits = buildApiKeyLimits({
      ...apiKeyPolicyDefaults(),
      quota_period: "weekly",
      models: [row({ model: "gpt-4o" })],
    });
    expect(limits.token_quota).toBeUndefined();
  });

  it("keeps a partially pinned entry from being broadened on save", () => {
    // { model, type } means "any external endpoint". Flattening it to { model }
    // would widen the entry to every endpoint of every type.
    const stored: ApiKeyLimits = {
      allowed_models: [{ model: "gpt-4o", type: "external" }],
    };
    const rebuilt = buildApiKeyLimits(limitsToForm(stored));
    expect(rebuilt.allowed_models).toEqual([
      { model: "gpt-4o", type: "external" },
    ]);
  });

  it("keeps an endpoint-only entry too", () => {
    const stored: ApiKeyLimits = {
      allowed_models: [{ model: "gpt-4o", endpoint_name: "ep-a" }],
    };
    const rebuilt = buildApiKeyLimits(limitsToForm(stored));
    expect(rebuilt.allowed_models).toEqual([
      { model: "gpt-4o", endpoint_name: "ep-a" },
    ]);
  });
});
