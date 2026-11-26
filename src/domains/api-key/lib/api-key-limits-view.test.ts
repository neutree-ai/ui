import { describe, expect, it } from "vitest";
import {
  apiKeyLimitsDisabled,
  apiKeyQuotaReadout,
  quotaUsageMeter,
} from "./api-key-limits-view";

describe("apiKeyLimitsDisabled", () => {
  it("is true only for the stored flag", () => {
    expect(apiKeyLimitsDisabled({ disabled: true })).toBe(true);
    expect(apiKeyLimitsDisabled({})).toBe(false);
    expect(apiKeyLimitsDisabled(null)).toBe(false);
  });
});

describe("quotaUsageMeter", () => {
  it.each([
    [10, 100, { percent: 10, over: false, warn: false }],
    [80, 100, { percent: 80, over: false, warn: true }],
    [100, 100, { percent: 100, over: true, warn: false }],
    [150, 100, { percent: 100, over: true, warn: false }],
  ])("%d of %d", (used, limit, meter) => {
    expect(quotaUsageMeter(used, limit)).toEqual(meter);
  });
});

describe("apiKeyQuotaReadout", () => {
  it("reads the overall quota, falling back to limit - used for remaining", () => {
    const readout = apiKeyQuotaReadout({
      token_quota: { limit: 1000, period: "daily", used: 900 },
      quota_resets_at: "2026-11-27",
    });
    expect(readout).toMatchObject({
      period: "daily",
      resetsAt: "2026-11-27",
      overall: { used: 900, limit: 1000, remaining: 100, warn: true },
      perModel: [],
    });
    expect(
      apiKeyQuotaReadout({
        token_quota: { limit: 1000, used: 1200, remaining: -150 },
      }).overall?.remaining,
    ).toBe(-150);
  });

  it("has no overall readout without a positive limit, and clamps an unknown period", () => {
    expect(
      apiKeyQuotaReadout({ token_quota: { limit: 0, period: "hourly" } }),
    ).toMatchObject({ period: "monthly", overall: null, perModel: [] });
  });

  it("lists only limited entries in per-model mode, ignoring the retained overall quota", () => {
    const readout = apiKeyQuotaReadout({
      quota_granularity: "per_model",
      quota_period: "weekly",
      token_quota: { limit: 1000 },
      allowed_models: [
        {
          model: "chat",
          type: "external",
          token_limit: 100,
          used: 120,
          remaining: -20,
        },
        { model: "chat", endpoint_name: "ep-a", token_limit: 50, used: 10 },
        { model: "free" },
      ],
    });
    expect(readout.overall).toBeNull();
    expect(readout.period).toBe("weekly");
    expect(readout.perModel).toEqual([
      {
        key: "external||chat",
        model: "chat",
        endpointName: undefined,
        type: "external",
        limit: 100,
        used: 120,
        remaining: -20,
        exhausted: true,
      },
      {
        key: "|ep-a|chat",
        model: "chat",
        endpointName: "ep-a",
        type: undefined,
        limit: 50,
        used: 10,
        remaining: 40,
        exhausted: false,
      },
    ]);
  });
});
