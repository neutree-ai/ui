import { useCustomMutation, useList } from "@refinedev/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AllowedModel, ApiKeyLimits } from "@/domains/api-key/types";
import { fetchAITraceKeyStats } from "@/foundation/lib/api/ai-traces";
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
};

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
    // Only accept a known period; an unexpected/empty value from the backend
    // would not match the combobox options, so fall back to the default.
    const period = limits.token_quota.period;
    v.quota_period = QUOTA_PERIODS.includes(period as QuotaPeriod)
      ? (period as QuotaPeriod)
      : "monthly";
  }
  if (limits.rps) v.rps = String(limits.rps);
  if (limits.rpm) v.rpm = String(limits.rpm);
  if (limits.concurrency) v.concurrency = String(limits.concurrency);
  v.models = (limits.allowed_models ?? []).map(
    (m): PolicyModelRow =>
      m.type && m.endpoint_name
        ? {
            value: modelOptionValue(m.type, m.endpoint_name, m.model),
            model: m.model,
            type: m.type,
            endpoint_name: m.endpoint_name,
          }
        : { value: m.model, model: m.model, wildcard: true },
  );
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
  type: "internal" | "external";
  phase: string | null;
};

type WorkspaceEndpointRef = {
  metadata?: { name?: string | null } | null;
  spec?: { model?: { name?: string | null } | null } | null;
  status?: { phase?: string | null } | null;
};

type WorkspaceExternalEndpointRef = {
  metadata?: { name?: string | null } | null;
  spec?: {
    upstreams?: {
      model_mapping?: Record<string, string> | null;
    }[];
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
  return spec.upstreams.flatMap((upstream) =>
    upstream.model_mapping ? Object.keys(upstream.model_mapping) : [],
  );
}

// Order the allowed-models options: status is the primary grouping (serving
// endpoints first, so usable models surface at the top), and within the same
// status, internal models are grouped before external ones, then a stable
// alphabetical order (model, endpoint). A Degraded external endpoint is still
// serving, so its models rank with the Running ones.
export function compareWorkspaceModelOptions(
  a: WorkspaceModelOption,
  b: WorkspaceModelOption,
): number {
  const runningRank = (phase: string | null) =>
    phase === "Running" || phase === "Degraded" ? 0 : 1;
  const typeRank = (type: WorkspaceModelOption["type"]) =>
    type === "internal" ? 0 : 1;
  return (
    runningRank(a.phase) - runningRank(b.phase) ||
    typeRank(a.type) - typeRank(b.type) ||
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
        phase: endpoint.status?.phase ?? null,
      });
    }

    for (const endpoint of externalEndpointsData?.data ?? []) {
      const endpointName = String(endpoint.metadata?.name ?? "").trim();
      if (!endpointName) continue;
      for (const model of exposedExternalModels(endpoint.spec)) {
        const trimmed = String(model ?? "").trim();
        if (!trimmed) continue;
        options.push({
          value: modelOptionValue("external", endpointName, trimmed),
          label: trimmed,
          model: trimmed,
          endpointName,
          type: "external",
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
  token_limit: number;
  used: number;
  remaining: number;
};

// Bulk per-API-key overall quota usage for a workspace, keyed by api_key_id.
// Backed by get_api_keys_usage_summary (one call). Powers the list usage column.
export function useAllApiKeyUsage(
  workspace: string | undefined,
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
          values: { p_workspace: workspace },
        });
        const rows =
          (res.data as ({ api_key_id: string } & ApiKeyUsage)[]) ?? [];
        const m = new Map<string, ApiKeyUsage>();
        for (const r of rows) {
          m.set(r.api_key_id, {
            period: r.period,
            token_limit: Number(r.token_limit),
            used: Number(r.used),
            remaining: Number(r.remaining),
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
  }, [mutateAsync, workspace]);
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
