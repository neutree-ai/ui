import type {
  AllowedModel,
  ApiKeyLimits,
  QuotaGranularity,
} from "@/domains/api-key/types";
import {
  modelOptionValue,
  nonBlankModelName,
} from "@/foundation/model-reference/use-workspace-models";
import {
  DEFAULT_TOKEN_QUOTA_UNIT,
  formatThousands,
  QUOTA_PERIODS,
  type QuotaPeriod,
  splitTokenQuota,
  type TokenQuotaUnit,
  toTokenCount,
} from "@/foundation/token-quota/token-quota";

// The limits form of an API key (create dialog and the detail Limits panel):
// form values, their validation, and the mapping to and from the limits object
// stored at api_key.spec.limits.

// Clamp a period from the backend to a known value, so the i18n lookup never
// renders a raw key when an unexpected/empty period comes back.
export const resolveQuotaPeriod = (
  period: string | null | undefined,
): QuotaPeriod =>
  QUOTA_PERIODS.includes(period as QuotaPeriod)
    ? (period as QuotaPeriod)
    : "monthly";

// A selected allowed-model row. `value` is the picker's composite key
// (`type:endpoint:model`) for a pinned entry, or the bare model name for a
// wildcard entry. The picker only ever creates pinned rows (type +
// endpoint_name set); `wildcard` rows come from loading a migrated legacy
// allowlist ("any endpoint of this model") and are shown read-only and passed
// through on save so an unrelated edit never silently drops them.
export type PolicyModelRow = {
  value: string;
  model: string;
  type?: "internal" | "external";
  endpoint_name?: string;
  wildcard?: boolean;
  // This entry's optional token quota, entered as amount + unit exactly like the
  // key's overall quota. An empty amount means "no limit on this model", which
  // is written as an absent `token_limit` — never as 0, which the backend
  // rejects. The unit is kept even while the amount is empty so clearing and
  // re-typing an amount does not silently change its magnitude.
  limit_amount?: string;
  limit_unit?: TokenQuotaUnit;
  // Read-only, from get_api_key_limits: this entry's consumption in the current
  // period. Only present on entries that already carry a stored limit.
  used?: number;
  remaining?: number;
};

// The token count an allowed-model row resolves to, or null when it carries no
// limit (or an amount that is not a whole positive number of tokens).
export const modelRowTokenLimit = (row: PolicyModelRow): number | null =>
  toTokenCount(
    row.limit_amount ?? "",
    row.limit_unit ?? DEFAULT_TOKEN_QUOTA_UNIT,
  );

// Whether a row's limit input is filled in at all. Distinct from
// modelRowTokenLimit: an in-progress or invalid amount ("1.5" tokens) still
// counts as an intent to set a per-model limit, so the mutual exclusion and the
// overlap check must react to it rather than wait for it to become valid.
const modelRowHasLimitInput = (row: PolicyModelRow): boolean =>
  String(row.limit_amount ?? "").trim() !== "";

// The key's quota granularity as the form currently expresses it. There is no
// mode flag anywhere: per-model is simply "some allowed-model row carries a
// limit", which is also how the backend derives it. An empty allowlist means
// every model is allowed and there is nowhere to hang a per-model limit, so
// such a key can only ever be `overall`.
export const formQuotaGranularity = (
  rows: PolicyModelRow[] | undefined,
): QuotaGranularity =>
  (rows ?? []).some(modelRowHasLimitInput) ? "per_model" : "overall";

// The `value`s of rows that overlap another row of the same model, mirroring
// api.validate_api_key_limits. A row leaving `type` / `endpoint_name` empty is a
// wildcard, so two rows of one model can both match a request; "used" and
// "remaining" are only attributable when the rows of a model form a partition.
//
// Two rows of the same model overlap unless they disagree on a dimension BOTH of
// them pin, and the rule only applies to models where some row carries a limit —
// migrated legacy keys with name-only entries and no per-model quota keep
// working untouched.
export function overlappingModelRowValues(
  rows: PolicyModelRow[] | undefined,
): Set<string> {
  const all = rows ?? [];
  const constrained = new Set(
    all.filter(modelRowHasLimitInput).map((r) => r.model),
  );
  const out = new Set<string>();
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i];
      const b = all[j];
      if (a.model !== b.model || !constrained.has(a.model)) continue;
      const typeDiffers = !!a.type && !!b.type && a.type !== b.type;
      const endpointDiffers =
        !!a.endpoint_name &&
        !!b.endpoint_name &&
        a.endpoint_name !== b.endpoint_name;
      if (typeDiffers || endpointDiffers) continue;
      out.add(a.value);
      out.add(b.value);
    }
  }
  return out;
}

export type ApiKeyPolicyFormValues = {
  quota_period: QuotaPeriod;
  // Token quota is entered as amount + unit; the token count sent to the
  // backend is quota_limit × quota_unit. Empty quota_limit = no quota.
  quota_limit: string; // display amount, may be comma-grouped and/or decimal
  quota_unit: TokenQuotaUnit;
  rps: string; // requests/second; empty = no per-second rate limit
  rpm: string; // requests/minute; empty = no per-minute rate limit
  concurrency: string; // max in-flight; empty = no limit
  models: PolicyModelRow[]; // allowed models; empty = unrestricted
};

export const apiKeyPolicyDefaults = (): ApiKeyPolicyFormValues => ({
  quota_period: "monthly",
  quota_limit: "",
  quota_unit: DEFAULT_TOKEN_QUOTA_UNIT,
  rps: "",
  rpm: "",
  concurrency: "",
  models: [],
});

const num = (s: string): number | undefined => {
  const v = String(s ?? "").trim();
  if (v === "" || Number(v) <= 0 || Number.isNaN(Number(v))) return undefined;
  return Number(v);
};

// Validate an optional positive-integer limit field. Empty = unset (valid); any
// provided value must be a positive integer, so 0 / negatives / decimals /
// non-numeric input are rejected at the form rather than silently dropped (which
// would turn an intended "0 = disable" into "no limit"). Mirrors the backend
// validate_api_key_limits RPC guard.
export const isPositiveIntLimit = (s: string): boolean => {
  const v = String(s ?? "").trim();
  if (v === "") return true;
  const n = Number(v);
  return Number.isInteger(n) && n > 0;
};

// Build the limits object from the form. `disabled` is preserved separately (it
// is toggled via its own action, not this form), so callers pass it through.
export function buildApiKeyLimits(
  values: ApiKeyPolicyFormValues,
  opts?: { disabled?: boolean },
): ApiKeyLimits {
  const limits: ApiKeyLimits = {};
  const qLimit =
    toTokenCount(values.quota_limit, values.quota_unit) ?? undefined;
  if (qLimit !== undefined) {
    limits.token_quota = { limit: qLimit, period: values.quota_period };
  }
  const rps = num(values.rps);
  if (rps !== undefined) limits.rps = rps;
  const rpm = num(values.rpm);
  if (rpm !== undefined) limits.rpm = rpm;
  const cc = num(values.concurrency);
  if (cc !== undefined) limits.concurrency = cc;
  // Emit endpoint-scoped entries. Pinned rows (from the picker) carry
  // type + endpoint_name; wildcard rows (migrated legacy) carry neither and pass
  // through as bare { model }. Dedup on the full (type,endpoint_name,model) key.
  const seen = new Set<string>();
  const allowed: AllowedModel[] = [];
  for (const r of values.models ?? []) {
    const model = nonBlankModelName(r.model);
    if (model === undefined) continue;
    // Emit whichever dimensions the row carries. A row the picker produced has
    // both; a stored entry that pins only one (which the backend allows, and a
    // CLI can write) must keep it -- dropping `type` would widen "any external
    // endpoint" into "any endpoint at all" on the next save.
    const entry: AllowedModel = { model };
    if (r.type) entry.type = r.type;
    if (r.endpoint_name) entry.endpoint_name = r.endpoint_name;
    // An absent token_limit is the only way to say "unlimited"; 0 is rejected by
    // the backend, so an empty or unusable amount emits no field at all.
    const tokenLimit = modelRowTokenLimit(r);
    if (tokenLimit !== null) entry.token_limit = tokenLimit;
    const key = JSON.stringify([
      entry.type ?? "",
      entry.endpoint_name ?? "",
      model,
    ]);
    if (seen.has(key)) continue;
    seen.add(key);
    allowed.push(entry);
  }
  if (allowed.length > 0) limits.allowed_models = allowed;
  // A key has exactly one quota period, but it is stored on token_quota — which
  // a per-model key has no amount for. Without this, choosing weekly alongside
  // per-model limits wrote no period at all and the backend silently fell back
  // to monthly.
  if (
    limits.token_quota === undefined &&
    allowed.some((e) => e.token_limit !== undefined)
  ) {
    limits.token_quota = { period: values.quota_period };
  }
  if (opts?.disabled) limits.disabled = true;
  return limits;
}

// Map a stored limits object back into editable form values (edit prefill).
export function limitsToForm(
  limits: ApiKeyLimits | null | undefined,
): ApiKeyPolicyFormValues {
  const v = apiKeyPolicyDefaults();
  if (!limits) return v;
  if (limits.token_quota?.limit && limits.token_quota.limit > 0) {
    // Prefill with the largest unit that divides the stored count exactly, so
    // saving an untouched form writes back the same number.
    const { amount, unit } = splitTokenQuota(limits.token_quota.limit);
    v.quota_limit = formatThousands(String(amount));
    v.quota_unit = unit;
    v.quota_period = resolveQuotaPeriod(limits.token_quota.period);
  }
  // In per-model mode token_quota may carry no period of its own, but the key
  // still has exactly one; get_api_key_limits echoes it as quota_period.
  if (limits.quota_period)
    v.quota_period = resolveQuotaPeriod(limits.quota_period);
  if (limits.rps) v.rps = String(limits.rps);
  if (limits.rpm) v.rpm = String(limits.rpm);
  if (limits.concurrency) v.concurrency = String(limits.concurrency);
  v.models = (limits.allowed_models ?? []).map((m): PolicyModelRow => {
    // Prefill an entry limit with the largest unit that divides it exactly, so
    // saving an untouched form writes back the same number (same rule as the
    // overall quota). No limit leaves the amount empty on the default unit.
    const hasLimit = !!m.token_limit && m.token_limit > 0;
    const split = hasLimit
      ? splitTokenQuota(m.token_limit as number)
      : { amount: 0, unit: DEFAULT_TOKEN_QUOTA_UNIT };
    const quota: Pick<
      PolicyModelRow,
      "limit_amount" | "limit_unit" | "used" | "remaining"
    > = {
      limit_amount: hasLimit ? formatThousands(String(split.amount)) : "",
      limit_unit: split.unit,
    };
    // used/remaining only exist on an entry that carries a limit; leave the
    // keys off entirely otherwise rather than carrying undefined around.
    if (typeof m.used === "number") quota.used = m.used;
    if (typeof m.remaining === "number") quota.remaining = m.remaining;
    if (m.type && m.endpoint_name) {
      return {
        value: modelOptionValue(m.type, m.endpoint_name, m.model),
        model: m.model,
        type: m.type,
        endpoint_name: m.endpoint_name,
        ...quota,
      };
    }
    // Not a row the picker can represent, so it stays a wildcard row -- but the
    // dimension it does pin is kept, so a save round-trips the entry instead of
    // broadening it.
    return {
      value: m.model,
      model: m.model,
      wildcard: true,
      ...(m.type ? { type: m.type } : {}),
      ...(m.endpoint_name ? { endpoint_name: m.endpoint_name } : {}),
      ...quota,
    };
  });
  return v;
}

// rate/concurrency summary parts for a key's limits (list "Rate limits" column).
export function rateSummary(limits: ApiKeyLimits | null | undefined): string[] {
  const out: string[] = [];
  if (!limits) return out;
  if (limits.rps) out.push(`${limits.rps} RPS`);
  if (limits.rpm) out.push(`${limits.rpm} RPM`);
  if (limits.concurrency) out.push(`${limits.concurrency} concurrent`);
  return out;
}

// Drop the computed read-only fields before writing limits back, so disable/save
// never persists stale used/remaining into spec.limits.
function stripComputed(limits: ApiKeyLimits | null | undefined): ApiKeyLimits {
  const l: ApiKeyLimits = { ...(limits ?? {}) };
  if (l.token_quota) {
    const { limit, period } = l.token_quota;
    if (limit && limit > 0) l.token_quota = { limit, period };
    // A per-model key carries the period with no overall amount; keeping the
    // bare { period } is what stops disable/enable from resetting the key to
    // the backend's default period.
    else if (period) l.token_quota = { period };
    else delete l.token_quota;
  }
  // get_api_key_limits folds per-entry used/remaining into the allowlist and
  // echoes the granularity/period it derived; none of that belongs in a write.
  if (l.allowed_models) {
    l.allowed_models = l.allowed_models.map(
      ({ used: _used, remaining: _remaining, ...entry }) => entry,
    );
  }
  delete l.quota_granularity;
  delete l.quota_period;
  delete l.quota_period_start;
  delete l.quota_resets_at;
  return l;
}

/** Stored limits rewritten for set_api_key_limits with only the disabled flag changed. */
export function limitsWithDisabled(
  limits: ApiKeyLimits | null | undefined,
  disabled: boolean,
): ApiKeyLimits {
  const next = stripComputed(limits);
  if (disabled) next.disabled = true;
  else delete next.disabled;
  return next;
}
