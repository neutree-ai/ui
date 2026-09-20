import { useCustomMutation, useList } from "@refinedev/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  AllowedModel,
  ApiKeyLimits,
  QuotaGranularity,
} from "@/domains/api-key/types";
import { fetchAITraceKeyStats } from "@/foundation/lib/api/ai-traces";
import {
  type ModelSource,
  modelSourceRank,
  modelsViaInternalEndpoint,
  resolveModelSource,
} from "@/foundation/lib/model-source";
import {
  DEFAULT_TOKEN_QUOTA_UNIT,
  formatThousands,
  splitTokenQuota,
  type TokenQuotaUnit,
  toTokenCount,
} from "@/foundation/lib/token-quota";

// API-key limits live on the key itself: quota + access are a single object
// stored at api_key.spec.limits and read/written via
// three RPCs:
//   create_api_key(..., p_limits)      - create with limits (atomic)
//   get_api_key_limits(p_id)           - config + current-period used/remaining
//   set_api_key_limits(p_id, p_limits) - replace the limits object
// Form types/constants live here; the shared ApiKeyLimits type comes from the
// domain's types.ts and trace stats from the foundation API layer.

export const QUOTA_PERIODS = ["daily", "weekly", "monthly", "yearly"] as const;
export type QuotaPeriod = (typeof QUOTA_PERIODS)[number];

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
    const model = String(r.model ?? "").trim();
    if (!model) continue;
    const pinned = !r.wildcard && !!r.type && !!r.endpoint_name;
    const entry: AllowedModel = pinned
      ? { model, type: r.type, endpoint_name: r.endpoint_name }
      : { model };
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
    return m.type && m.endpoint_name
      ? {
          value: modelOptionValue(m.type, m.endpoint_name, m.model),
          model: m.model,
          type: m.type,
          endpoint_name: m.endpoint_name,
          ...quota,
        }
      : { value: m.model, model: m.model, wildcard: true, ...quota };
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
  return l;
}

// Load a single API key's limits (edit). Writes go through
// update_api_key_configuration, which replaces the whole limits object (single
// source of truth) alongside the key's identity and Project in one call.
export function useApiKeyLimits() {
  const { mutateAsync } = useCustomMutation();

  const load = useCallback(
    async (apiKeyId: string): Promise<ApiKeyLimits> => {
      const res = await mutateAsync({
        url: "/rpc/get_api_key_limits",
        method: "post",
        values: { p_id: apiKeyId },
      });
      return (res.data as ApiKeyLimits) ?? {};
    },
    [mutateAsync],
  );

  return { load };
}

// Toggle a key's disabled state by rewriting its limits object (preserving the
// rest of the config). Disable sets limits.disabled=true (gateway then rejects
// every request with 403 key_disabled); enable removes the flag.
export function useApiKeyDisable() {
  const { mutateAsync } = useCustomMutation();
  const setDisabled = useCallback(
    async (apiKeyId: string, disabled: boolean) => {
      const res = await mutateAsync({
        url: "/rpc/get_api_key_limits",
        method: "post",
        values: { p_id: apiKeyId },
      });
      const next = stripComputed((res.data as ApiKeyLimits) ?? {});
      if (disabled) next.disabled = true;
      else delete next.disabled;
      await mutateAsync({
        url: "/rpc/set_api_key_limits",
        method: "post",
        values: { p_id: apiKeyId, p_limits: next },
      });
    },
    [mutateAsync],
  );
  return {
    disable: (id: string) => setDisabled(id, true),
    enable: (id: string) => setDisabled(id, false),
  };
}

export type WorkspaceModelOption = {
  value: string;
  label: string;
  model: string;
  endpointName: string;
  // The endpoint kind. Still the half of the allowlist triple that is written
  // to the API, and still what `value` is keyed on, even though it is no longer
  // shown as a badge — `source` displays instead.
  type: "internal" | "external";
  // The displayed source label. Derived as `self-hosted` for every internal
  // endpoint; read from the external endpoint's `neutree.ai/model-source`
  // label otherwise, and `undefined` when it carries none.
  source: ModelSource | undefined;
  phase: string | null;
};

type WorkspaceEndpointRef = {
  metadata?: { name?: string | null } | null;
  spec?: { model?: { name?: string | null } | null } | null;
  status?: { phase?: string | null } | null;
};

type WorkspaceExternalEndpointRef = {
  metadata?: {
    name?: string | null;
    labels?: Record<string, string> | null;
  } | null;
  spec?: {
    model_routes?: { model?: string | null }[] | null;
    upstreams?: {
      model_mapping?: Record<string, string> | null;
      endpoint_ref?: string | null;
    }[];
    // Keyed by the client-facing model name; one endpoint's models can differ.
    model_sources?: Record<string, string> | null;
  } | null;
  status?: { phase?: string | null } | null;
};

const modelOptionValue = (
  type: WorkspaceModelOption["type"],
  endpointName: string,
  model: string,
) => `${type}:${endpointName}:${model}`;

function exposedExternalModels(
  spec: WorkspaceExternalEndpointRef["spec"],
): string[] {
  if (!spec?.upstreams) return [];
  if (spec.model_routes?.length) {
    return spec.model_routes
      .map((route) => route.model)
      .filter((model): model is string => Boolean(model));
  }
  return spec.upstreams.flatMap((upstream) =>
    upstream.model_mapping ? Object.keys(upstream.model_mapping) : [],
  );
}

// Order the allowed-models options: source is the primary grouping, so the
// picker can render one contiguous section per source and the cost profile of
// a model is visible before anything else. Within a source, serving endpoints
// come first (usable models at the top of their section), then a stable
// alphabetical order (model, endpoint). A Degraded external endpoint is still
// serving, so its models rank with the Running ones.
//
// Source-first still puts internal models first overall, because `self-hosted`
// is the first preset and only internal endpoints ever carry it — the property
// the IE/EE distinction in the picker rests on.
export function compareWorkspaceModelOptions(
  a: WorkspaceModelOption,
  b: WorkspaceModelOption,
): number {
  const runningRank = (phase: string | null) =>
    phase === "Running" || phase === "Degraded" ? 0 : 1;
  return (
    modelSourceRank(a.source) - modelSourceRank(b.source) ||
    (a.source ?? "").localeCompare(b.source ?? "") ||
    runningRank(a.phase) - runningRank(b.phase) ||
    a.model.localeCompare(b.model) ||
    a.endpointName.localeCompare(b.endpointName)
  );
}

// Available client-facing models in a workspace (for the allowed-models
// dropdown). Options are endpoint-level rows so duplicate model names served by
// different internal/external endpoints remain visually distinct in the picker.
export function useWorkspaceModels(
  workspace: string | undefined,
): WorkspaceModelOption[] {
  const enabled = Boolean(workspace);
  const { data: endpointsData } = useList<WorkspaceEndpointRef>({
    resource: "endpoints",
    pagination: { mode: "off" },
    meta: { workspace, workspaced: true },
    queryOptions: { enabled },
  });
  const { data: externalEndpointsData } = useList<WorkspaceExternalEndpointRef>(
    {
      resource: "external_endpoints",
      pagination: { mode: "off" },
      meta: { workspace, workspaced: true },
      queryOptions: { enabled },
    },
  );

  return useMemo(() => {
    if (!workspace) return [];
    const options: WorkspaceModelOption[] = [];

    for (const endpoint of endpointsData?.data ?? []) {
      const model = String(endpoint.spec?.model?.name ?? "").trim();
      const endpointName = String(endpoint.metadata?.name ?? "").trim();
      if (!model || !endpointName) continue;
      options.push({
        value: modelOptionValue("internal", endpointName, model),
        label: model,
        model,
        endpointName,
        type: "internal",
        source: resolveModelSource("internal"),
        phase: endpoint.status?.phase ?? null,
      });
    }

    for (const endpoint of externalEndpointsData?.data ?? []) {
      const endpointName = String(endpoint.metadata?.name ?? "").trim();
      if (!endpointName) continue;
      const viaInternal = modelsViaInternalEndpoint(endpoint.spec?.upstreams);
      for (const model of exposedExternalModels(endpoint.spec)) {
        const trimmed = String(model ?? "").trim();
        if (!trimmed) continue;
        options.push({
          value: modelOptionValue("external", endpointName, trimmed),
          label: trimmed,
          model: trimmed,
          endpointName,
          type: "external",
          // Resolved per model, not once per endpoint: two models of one
          // endpoint can genuinely have different sources.
          source: resolveModelSource(
            "external",
            endpoint.spec?.model_sources,
            trimmed,
            { viaInternalEndpoint: viaInternal.has(trimmed) },
          ),
          phase: endpoint.status?.phase ?? null,
        });
      }
    }

    return options.sort(compareWorkspaceModelOptions);
  }, [endpointsData?.data, externalEndpointsData?.data, workspace]);
}

// Per-model serving info: whether the model is served internally / externally
// and the endpoint(s) that serve it. Powers the list Models column and the
// detail Model access section (aligning name + Internal/External + endpoint).
type ModelEndpoint = {
  name: string;
  type: "internal" | "external";
  source: ModelSource | undefined;
  phase: string | null;
};
type ModelInfo = {
  internal: boolean;
  external: boolean;
  endpoints: ModelEndpoint[];
};

// Map of model name -> serving info for a workspace.
export function useWorkspaceModelMap(
  workspace: string | undefined,
): Map<string, ModelInfo> {
  const options = useWorkspaceModels(workspace);

  return useMemo(() => {
    const m = new Map<string, ModelInfo>();
    for (const option of options) {
      const info = m.get(option.model) ?? {
        internal: false,
        external: false,
        endpoints: [],
      };
      if (option.type === "external") info.external = true;
      else info.internal = true;
      if (
        !info.endpoints.some(
          (e) => e.name === option.endpointName && e.type === option.type,
        )
      ) {
        info.endpoints.push({
          name: option.endpointName,
          type: option.type,
          source: option.source,
          phase: option.phase,
        });
      }
      m.set(option.model, info);
    }
    return m;
  }, [options]);
}

type ApiKeyUsage = {
  period: string;
  // Which quota the key actually enforces. A per-model key has no single pool,
  // so token_limit / remaining are null while `used` still carries the key's
  // total period usage.
  granularity: QuotaGranularity;
  token_limit: number | null;
  used: number;
  remaining: number | null;
  // The most utilised LIMITED model of a per-model key — the one figure a list
  // can honestly show when limits differ per model and some models have none.
  // Null for an overall-quota key, and for a per-model key whose limited models
  // have no recorded usage yet.
  top_model: string | null;
  top_model_type: string | null;
  top_model_used: number | null;
  top_model_limit: number | null;
  // Limited models only; unlimited ones have no ratio and do not compete.
  limited_models: number;
};

// Bulk per-API-key overall quota usage for a workspace, keyed by api_key_id.
// Backed by get_api_keys_usage_summary (one call). Powers the list usage column.
export function useAllApiKeyUsage(
  workspace: string | undefined,
  // The keys actually being rendered. The per-model figures cost
  // keys x models x days to compute, so the summary is scoped to one page;
  // omitting this asks the server for the whole workspace.
  apiKeyIds?: string[],
): Map<string, ApiKeyUsage> {
  const { mutateAsync } = useCustomMutation();
  const [byKey, setByKey] = useState<Map<string, ApiKeyUsage>>(new Map());
  useEffect(() => {
    if (!workspace) {
      setByKey(new Map());
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await mutateAsync({
          url: "/rpc/get_api_keys_usage_summary",
          method: "post",
          values: {
            p_workspace: workspace,
            p_api_key_ids: apiKeyIds?.length ? apiKeyIds : null,
          },
        });
        const rows =
          (res.data as ({ api_key_id: string } & ApiKeyUsage)[]) ?? [];
        const m = new Map<string, ApiKeyUsage>();
        // token_limit / remaining come back NULL for a per-model key; keep them
        // null rather than coercing to 0, which would read as "exhausted".
        const numberOrNull = (v: number | null | undefined) =>
          v == null ? null : Number(v);
        for (const r of rows) {
          m.set(r.api_key_id, {
            period: r.period,
            granularity:
              r.granularity === "per_model" ? "per_model" : "overall",
            token_limit: numberOrNull(r.token_limit),
            used: Number(r.used),
            remaining: numberOrNull(r.remaining),
            top_model: r.top_model ?? null,
            top_model_type: r.top_model_type ?? null,
            top_model_used: numberOrNull(r.top_model_used),
            top_model_limit: numberOrNull(r.top_model_limit),
            limited_models: Number(r.limited_models ?? 0),
          });
        }
        if (!cancelled) setByKey(m);
      } catch {
        if (!cancelled) setByKey(new Map());
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mutateAsync, workspace, (apiKeyIds ?? []).join(",")]);
  return byKey;
}

// One API key's aggregated 24h traffic, derived from inference traces.
export type ApiKeyTraffic = {
  requests: number;
  tokens: number;
  success: number;
  avgDurationMs: number;
  // success / requests in [0,1]; null when there were no requests.
  successRate: number | null;
};

// Bulk per-API-key 24h traffic for a workspace, keyed by api_key_id. Backed by
// the trace store (fetchAITraceKeyStats, one call). Powers the list ranking
// overview and the detail "request performance" card. Returns an empty map when
// the trace store is unavailable or there is no traffic — callers render an
// empty state, never an error.
export function useAllApiKeyTraffic(
  workspace: string | undefined,
  windowHours = 24,
): Map<string, ApiKeyTraffic> {
  const [byKey, setByKey] = useState<Map<string, ApiKeyTraffic>>(new Map());
  useEffect(() => {
    if (!workspace) {
      setByKey(new Map());
      return;
    }
    const controller = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchAITraceKeyStats(
          workspace,
          windowHours,
          controller.signal,
        );
        const m = new Map<string, ApiKeyTraffic>();
        for (const k of res.keys ?? []) {
          const requests = Number(k.requests) || 0;
          const success = Number(k.success) || 0;
          m.set(k.api_key_id, {
            requests,
            tokens: Number(k.tokens) || 0,
            success,
            avgDurationMs: Number(k.avg_duration_ms) || 0,
            successRate: requests > 0 ? success / requests : null,
          });
        }
        if (!cancelled) setByKey(m);
      } catch {
        if (!cancelled) setByKey(new Map());
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [workspace, windowHours]);
  return byKey;
}
