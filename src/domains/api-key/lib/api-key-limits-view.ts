import { resolveQuotaPeriod } from "@/domains/api-key/lib/api-key-policy-form";
import type { ApiKeyLimits } from "@/domains/api-key/types";

/** Whether the key's gateway access is switched off (limits.disabled). */
export const apiKeyLimitsDisabled = (
  limits: ApiKeyLimits | null | undefined,
): boolean => !!limits?.disabled;

/** Bar fill (0-100) and tone of `used` against a positive `limit`; warns from 80%. */
export function quotaUsageMeter(
  used: number,
  limit: number,
): { percent: number; over: boolean; warn: boolean } {
  const ratio = used / limit;
  const over = used >= limit;
  return {
    percent: Math.max(0, Math.min(100, ratio * 100)),
    over,
    warn: !over && ratio >= 0.8,
  };
}

// Used, limit and remaining of one quota. The backend-computed remaining is
// authoritative and may be negative (a soft quota can be overshot before
// enforcement catches up); limit - used is only the fallback for a response
// that does not carry it.
const consumption = (q: {
  limit?: number;
  used?: number;
  remaining?: number;
}) => {
  const used = Number(q.used ?? 0) || 0;
  const limit = Number(q.limit ?? 0) || 0;
  const remaining =
    typeof q.remaining === "number" ? q.remaining : limit - used;
  return { used, limit, remaining };
};

/**
 * Current-period consumption of a key's limits from get_api_key_limits: the
 * overall quota when that is what the key enforces, else one row per allowlist
 * entry that carries a limit (unlimited entries have no used/remaining). Which
 * quota is in force follows the backend's quota_granularity, never whether
 * token_quota exists: it is retained in per-model mode as the fallback.
 */
export function apiKeyQuotaReadout(limits: ApiKeyLimits) {
  const granularity = limits.quota_granularity ?? "overall";
  const quota = limits.token_quota;
  const overallQuota =
    granularity === "overall" && quota?.limit && quota.limit > 0
      ? consumption(quota)
      : null;
  const perModel =
    granularity === "per_model"
      ? (limits.allowed_models ?? [])
          .filter((m) => typeof m.token_limit === "number")
          .map((m) => {
            const row = consumption({ ...m, limit: m.token_limit });
            return {
              key: `${m.type ?? ""}|${m.endpoint_name ?? ""}|${m.model}`,
              model: m.model,
              endpointName: m.endpoint_name || undefined,
              type: m.type || undefined,
              ...row,
              exhausted: row.remaining <= 0,
            };
          })
      : [];
  return {
    // Clamped so the i18n lookup never renders a raw key; quota_period is the
    // key's single period, token_quota.period the fallback of older responses.
    period: resolveQuotaPeriod(limits.quota_period ?? quota?.period),
    // Server-computed; absent on an older response, in which case the period
    // name is shown on its own rather than a date this client guessed.
    resetsAt: limits.quota_resets_at,
    overall: overallQuota && {
      ...overallQuota,
      ...quotaUsageMeter(overallQuota.used, overallQuota.limit),
    },
    perModel,
  };
}
