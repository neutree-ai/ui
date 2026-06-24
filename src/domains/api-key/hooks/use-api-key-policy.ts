import { useCustomMutation } from "@refinedev/core";
import { useCallback, useEffect, useState } from "react";
import type { ApiKeyLimits } from "@/domains/api-key/types";
import { fetchAITraceKeyStats } from "@/foundation/lib/api/ai-traces";

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

export type PolicyModelRow = { value: string };

export type ApiKeyPolicyFormValues = {
  quota_period: QuotaPeriod;
  quota_limit: string; // tokens; empty = no quota
  rps: string; // requests/second; empty = no per-second rate limit
  rpm: string; // requests/minute; empty = no per-minute rate limit
  concurrency: string; // max in-flight; empty = no limit
  models: PolicyModelRow[]; // allowed models; empty = unrestricted
};

export const apiKeyPolicyDefaults = (): ApiKeyPolicyFormValues => ({
  quota_period: "monthly",
  quota_limit: "",
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

// Build the limits object from the form. `disabled` is preserved separately (it
// is toggled via its own action, not this form), so callers pass it through.
export function buildApiKeyLimits(
  values: ApiKeyPolicyFormValues,
  opts?: { disabled?: boolean },
): ApiKeyLimits {
  const limits: ApiKeyLimits = {};
  const qLimit = num(values.quota_limit);
  if (qLimit !== undefined) {
    limits.token_quota = { limit: qLimit, period: values.quota_period };
  }
  const rps = num(values.rps);
  if (rps !== undefined) limits.rps = rps;
  const rpm = num(values.rpm);
  if (rpm !== undefined) limits.rpm = rpm;
  const cc = num(values.concurrency);
  if (cc !== undefined) limits.concurrency = cc;
  const models = (values.models ?? [])
    .map((m) => String(m.value ?? "").trim())
    .filter((m) => m !== "");
  if (models.length > 0) limits.allowed_models = models;
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
    v.quota_limit = String(limits.token_quota.limit);
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
  v.models = (limits.allowed_models ?? []).map((m) => ({ value: m }));
  return v;
}

// Compact, en-US summary of a key's limits for detail display.
export function summarizeApiKeyLimits(
  limits: ApiKeyLimits | null | undefined,
): string[] {
  const out: string[] = [];
  if (!limits) return out;
  const periodShort: Record<string, string> = {
    daily: "day",
    weekly: "wk",
    monthly: "mo",
    yearly: "yr",
  };
  if (limits.token_quota?.limit && limits.token_quota.limit > 0) {
    const p = limits.token_quota.period ?? "monthly";
    out.push(
      `${limits.token_quota.limit.toLocaleString()} tok/${periodShort[p] ?? p}`,
    );
  }
  if (limits.rps) out.push(`${limits.rps} RPS`);
  if (limits.rpm) out.push(`${limits.rpm} RPM`);
  if (limits.concurrency) out.push(`${limits.concurrency} concurrent`);
  if (limits.allowed_models && limits.allowed_models.length > 0) {
    out.push(`models: ${limits.allowed_models.join(", ")}`);
  }
  return out;
}

// rate/concurrency summary parts for a key's limits (list "Rate limits" column).
export function rateSummary(
  limits: ApiKeyLimits | null | undefined,
): string[] {
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

// Load + save a single API key's limits (edit). save() replaces the whole limits
// object (single source of truth), preserving the separately-toggled disabled.
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

  const save = useCallback(
    async (
      apiKeyId: string,
      values: ApiKeyPolicyFormValues,
      opts?: { disabled?: boolean },
    ) => {
      const limits = buildApiKeyLimits(values, { disabled: opts?.disabled });
      await mutateAsync({
        url: "/rpc/set_api_key_limits",
        method: "post",
        values: { p_id: apiKeyId, p_limits: limits },
      });
    },
    [mutateAsync],
  );

  return { load, save };
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

// Available client-facing models in a workspace (for the allowed-models
// dropdown). The label shows the serving endpoint name(s) annotated with type —
// internal (regular endpoint) / external (external endpoint) — so the user picks
// by where the model is actually served, e.g. `gpt-4 (openrouter-free [external])`.
// A model served by several endpoints lists all of them. Backed by
// get_workspace_models.
export function useWorkspaceModels(
  workspace: string | undefined,
): { value: string; label: string }[] {
  const { mutateAsync } = useCustomMutation();
  const [opts, setOpts] = useState<{ value: string; label: string }[]>([]);
  useEffect(() => {
    if (!workspace) {
      setOpts([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await mutateAsync({
          url: "/rpc/get_workspace_models",
          method: "post",
          values: { p_workspace: workspace },
        });
        const rows =
          (res.data as {
            model: string;
            source: string;
            endpoint_name: string | null;
          }[]) ?? [];
        // Collect the serving endpoint name(s) per model, each annotated with its
        // type (internal = regular endpoint, external = external endpoint).
        // Deduped and sorted, e.g. `gpt-4 (openrouter-free [external])`.
        const byModel = new Map<string, Set<string>>();
        for (const r of rows) {
          const entries = byModel.get(r.model) ?? new Set<string>();
          const name = String(r.endpoint_name ?? "").trim();
          const type =
            r.source === "external_endpoint" ? "external" : "internal";
          if (name !== "") entries.add(`${name} [${type}]`);
          byModel.set(r.model, entries);
        }
        const out = [...byModel.entries()]
          .map(([model, entries]) => {
            const list = [...entries].sort((a, b) => a.localeCompare(b));
            return {
              value: model,
              label: list.length > 0 ? `${model} (${list.join(", ")})` : model,
            };
          })
          .sort((a, b) => a.label.localeCompare(b.label));
        if (!cancelled) setOpts(out);
      } catch {
        if (!cancelled) setOpts([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mutateAsync, workspace]);
  return opts;
}

// Per-model serving info: whether the model is served internally / externally
// and the endpoint(s) that serve it. Powers the list Models column and the
// detail Model access section (aligning name + Internal/External + endpoint).
type ModelEndpoint = { name: string; type: "internal" | "external" };
type ModelInfo = {
  internal: boolean;
  external: boolean;
  endpoints: ModelEndpoint[];
};

// Map of model name -> serving info for a workspace, from get_workspace_models.
export function useWorkspaceModelMap(
  workspace: string | undefined,
): Map<string, ModelInfo> {
  const { mutateAsync } = useCustomMutation();
  const [map, setMap] = useState<Map<string, ModelInfo>>(new Map());
  useEffect(() => {
    if (!workspace) {
      setMap(new Map());
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await mutateAsync({
          url: "/rpc/get_workspace_models",
          method: "post",
          values: { p_workspace: workspace },
        });
        const rows =
          (res.data as {
            model: string;
            source: string;
            endpoint_name: string | null;
          }[]) ?? [];
        const m = new Map<string, ModelInfo>();
        for (const r of rows) {
          const type: "internal" | "external" =
            r.source === "external_endpoint" ? "external" : "internal";
          const info = m.get(r.model) ?? {
            internal: false,
            external: false,
            endpoints: [],
          };
          if (type === "external") info.external = true;
          else info.internal = true;
          const name = String(r.endpoint_name ?? "").trim();
          if (name && !info.endpoints.some((e) => e.name === name && e.type === type)) {
            info.endpoints.push({ name, type });
          }
          m.set(r.model, info);
        }
        if (!cancelled) setMap(m);
      } catch {
        if (!cancelled) setMap(new Map());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mutateAsync, workspace]);
  return map;
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
