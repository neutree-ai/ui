import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiKeyLimits } from "@/domains/api-key/types";
import { SELF_HOSTED_MODEL_SOURCE } from "@/foundation/lib/model-source";
import { DEFAULT_TOKEN_QUOTA_UNIT } from "@/foundation/lib/token-quota";
import {
  type ApiKeyPolicyFormValues,
  apiKeyPolicyDefaults,
  buildApiKeyLimits,
  formQuotaGranularity,
  invokableModelOptions,
  isPositiveIntLimit,
  limitsToForm,
  modelRowTokenLimit,
  overlappingModelRowValues,
  type PolicyModelRow,
  rateSummary,
  resolveQuotaPeriod,
  useModelSourceByValue,
  useWorkspaceModelMap,
} from "./use-api-key-policy";

const { useListMock } = vi.hoisted(() => ({ useListMock: vi.fn() }));

vi.mock("@refinedev/core", () => ({
  useList: useListMock,
  useCustomMutation: vi.fn(),
}));

const mockWorkspaceModels = (
  servedModels: string[] | null | undefined,
  externalModel = "a",
) => {
  const endpoints = [
    {
      metadata: { name: "local" },
      spec: { model: { name: "physical-model" } },
      status: { served_models: servedModels },
    },
  ];
  const externalEndpoints = [
    {
      metadata: { name: "external" },
      spec: {
        upstreams: [{ model_mapping: { [externalModel]: "provider-model" } }],
        model_sources: { [externalModel]: "third-party-public" },
      },
    },
  ];
  useListMock.mockImplementation(({ resource }) => ({
    data: { data: resource === "endpoints" ? endpoints : externalEndpoints },
  }));
};

const form = (
  over: Partial<ApiKeyPolicyFormValues> = {},
): ApiKeyPolicyFormValues => ({
  ...apiKeyPolicyDefaults(),
  ...over,
});

const row = (over: Partial<PolicyModelRow>): PolicyModelRow => ({
  value: `${over.type ?? ""}:${over.endpoint_name ?? ""}:${over.model ?? "m"}`,
  model: "m",
  ...over,
});

describe("isPositiveIntLimit", () => {
  // Empty means "unset", which is valid for an optional limit.
  it.each([
    ["", true],
    ["   ", true],
    ["1", true],
    ["500000", true],
    ["0", false],
    ["-1", false],
    ["1.5", false],
    ["abc", false],
  ])("%j -> %s", (input, valid) => {
    expect(isPositiveIntLimit(input)).toBe(valid);
  });
});

describe("buildApiKeyLimits", () => {
  it("emits an empty object when all limits are empty", () => {
    expect(buildApiKeyLimits(apiKeyPolicyDefaults())).toEqual({});
  });

  it("emits token_quota for a positive token limit", () => {
    expect(
      buildApiKeyLimits(
        form({
          quota_period: "monthly",
          quota_limit: "500,000",
          quota_unit: "tokens",
        }),
      ),
    ).toEqual({ token_quota: { limit: 500000, period: "monthly" } });
  });

  it.each([
    ["200", "M", 200_000_000],
    ["1.5", "M", 1_500_000],
    ["2", "B", 2_000_000_000],
    ["10", "K", 10_000],
    // Does not resolve to whole tokens, so no quota is sent.
    ["1.5", "tokens", undefined],
  ] as const)("%s %s -> %s tokens", (quota_limit, quota_unit, limit) => {
    expect(
      buildApiKeyLimits(form({ quota_limit, quota_unit })).token_quota?.limit,
    ).toBe(limit);
  });

  it("maps RPS / RPM / concurrency and drops rows with a blank model", () => {
    const v = form({
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
    });
    expect(buildApiKeyLimits(v)).toEqual({
      rps: 10,
      rpm: 600,
      concurrency: 8,
      allowed_models: [
        { model: "gpt-4o", type: "external", endpoint_name: "ee-a" },
      ],
    });
  });

  it("saves a model name verbatim, untrimmed", () => {
    const model = " qwen ";
    expect(
      buildApiKeyLimits(
        form({
          models: [row({ model, type: "internal", endpoint_name: "local" })],
        }),
      ).allowed_models,
    ).toEqual([{ model, type: "internal", endpoint_name: "local" }]);
  });

  it("keeps endpoint-scoped selections distinct (same model, different endpoints)", () => {
    const v = form({
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
    });
    expect(buildApiKeyLimits(v)).toEqual({
      allowed_models: [
        { model: "gpt-4o", type: "internal", endpoint_name: "chat-a" },
        { model: "gpt-4o", type: "external", endpoint_name: "openrouter" },
        { model: "claude", type: "external", endpoint_name: "anthropic" },
      ],
    });
  });

  it("passes wildcard (any-source) rows through and dedups them", () => {
    const v = form({
      models: [
        { value: "gpt-4o", model: "gpt-4o", wildcard: true },
        { value: "gpt-4o", model: "gpt-4o", wildcard: true },
      ],
    });
    expect(buildApiKeyLimits(v)).toEqual({
      allowed_models: [{ model: "gpt-4o" }],
    });
  });

  it("ignores zero / blank values", () => {
    expect(
      buildApiKeyLimits(form({ quota_limit: "0", rps: "", concurrency: "0" })),
    ).toEqual({});
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

  it.each(["fortnightly", ""])(
    "falls back to the default period for period %j",
    (period) => {
      expect(
        limitsToForm({ token_quota: { limit: 100, period } }).quota_period,
      ).toBe("monthly");
    },
  );
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

describe("modelRowTokenLimit", () => {
  // 0 is never "unlimited" and never "disabled" — the backend rejects it, so
  // it must not reach the wire as a token_limit.
  it.each([
    [{ limit_amount: "50", limit_unit: "M" }, 50_000_000],
    [{ limit_amount: "", limit_unit: "M" }, null],
    [{}, null],
    [{ limit_amount: "0", limit_unit: "M" }, null],
    [{ limit_amount: "1.5", limit_unit: "tokens" }, null],
  ] as const)("%j -> %s", (over, limit) => {
    expect(modelRowTokenLimit(row(over))).toBe(limit);
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
  it.each([
    ["weekly", "weekly"],
    ["fortnightly", "monthly"],
    [null, "monthly"],
    [undefined, "monthly"],
  ])("%j -> %s", (period, resolved) => {
    expect(resolveQuotaPeriod(period)).toBe(resolved);
  });
});

describe("buildApiKeyLimits per-model quota", () => {
  it("hangs the limit off the allowlist entry and omits it when unset", () => {
    const limits = buildApiKeyLimits(
      form({
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
      }),
    );
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
    const limits = buildApiKeyLimits(
      form({
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
      }),
    );
    expect(limits.token_quota).toEqual({ limit: 1_000_000, period: "monthly" });
  });

  it("carries a limit on a wildcard (any-source) entry", () => {
    const limits = buildApiKeyLimits(
      form({
        models: [
          row({
            model: "gpt-4o",
            wildcard: true,
            limit_amount: "500",
            limit_unit: "K",
          }),
        ],
      }),
    );
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
    const limits = buildApiKeyLimits(
      form({
        quota_period: "weekly",
        models: [
          row({ model: "gpt-4o", limit_amount: "500", limit_unit: "K" }),
        ],
      }),
    );
    expect(limits.token_quota).toEqual({ period: "weekly" });
  });

  it("does not invent a token_quota for a key with no limits at all", () => {
    const limits = buildApiKeyLimits(
      form({
        quota_period: "weekly",
        models: [row({ model: "gpt-4o" })],
      }),
    );
    expect(limits.token_quota).toBeUndefined();
  });

  // { model, type } means "any external endpoint". Flattening a partially
  // pinned entry to { model } would widen it to every endpoint of every type.
  it.each([
    { model: "gpt-4o", type: "external" as const },
    { model: "gpt-4o", endpoint_name: "ep-a" },
  ])("keeps the partially pinned entry %j on save", (entry) => {
    const rebuilt = buildApiKeyLimits(
      limitsToForm({ allowed_models: [entry] }),
    );
    expect(rebuilt.allowed_models).toEqual([entry]);
  });
});

describe("useWorkspaceModelMap", () => {
  beforeEach(() => {
    useListMock.mockReset();
  });

  it("updates lookup maps when the first alias changes, retaining the external model", () => {
    mockWorkspaceModels(["a", "b"]);
    const { result, rerender } = renderHook(() => ({
      models: useWorkspaceModelMap("workspace-a"),
      sources: useModelSourceByValue("workspace-a"),
    }));
    expect(
      result.current.models
        .get("a")
        ?.endpoints.map((e) => e.name)
        .sort(),
    ).toEqual(["external", "local"]);
    expect(result.current.models.has("b")).toBe(false);
    expect(result.current.sources.get("internal:local:a")).toBe(
      SELF_HOSTED_MODEL_SOURCE,
    );

    mockWorkspaceModels(["b", "a"]);
    rerender();
    expect(
      result.current.models.get("a")?.endpoints.map((e) => e.name),
    ).toEqual(["external"]);
    expect(
      result.current.models.get("b")?.endpoints.map((e) => e.name),
    ).toEqual(["local"]);
    expect(result.current.sources.has("internal:local:a")).toBe(false);
    expect(result.current.sources.get("internal:local:b")).toBe(
      SELF_HOSTED_MODEL_SOURCE,
    );
    expect(result.current.sources.get("external:external:a")).toBe(
      "third-party-public",
    );
  });
});

describe("invokableModelOptions", () => {
  it("leaves out rows whose endpoint is being deleted", () => {
    const row = {
      model: "qwen",
      type: "internal",
      endpoint_name: "ep-qwen",
      source_label: null,
      phase: "Deleting",
    };
    expect(invokableModelOptions([row], [], "default")).toEqual([]);
  });

  it("builds options from list_invokable_models with phases when known", () => {
    const options = invokableModelOptions(
      [
        {
          model: "gpt-4o",
          type: "external",
          endpoint_name: "ep-vendor",
          source_label: "third-party-public",
        },
        {
          model: "qwen",
          type: "internal",
          endpoint_name: "ep-qwen",
          source_label: null,
        },
      ],
      [
        {
          value: "internal:ep-qwen:qwen",
          label: "qwen",
          model: "qwen",
          endpointName: "ep-qwen",
          type: "internal",
          source: SELF_HOSTED_MODEL_SOURCE,
          phase: "Running",
        },
      ],
      "default",
    );
    expect(options.map((o) => [o.value, o.source, o.phase])).toEqual([
      ["internal:ep-qwen:qwen", SELF_HOSTED_MODEL_SOURCE, "Running"],
      ["external:ep-vendor:gpt-4o", "third-party-public", null],
    ]);
  });

  it("takes the phase from the row, so endpoint reads are not needed", () => {
    const options = invokableModelOptions(
      [
        {
          model: "deepseek",
          type: "external",
          endpoint_name: "ep-vendor",
          source_label: "third-party-public",
          phase: "Running",
        },
      ],
      [],
      "default",
    );
    expect(options.map((o) => [o.value, o.phase])).toEqual([
      ["external:ep-vendor:deepseek", "Running"],
    ]);
  });
});
