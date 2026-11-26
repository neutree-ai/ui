import { useCustom, useCustomMutation } from "@refinedev/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import { limitsWithDisabled } from "@/domains/api-key/lib/api-key-policy-form";
import type { ApiKeyLimits, QuotaGranularity } from "@/domains/api-key/types";
import { fetchAITraceKeyStats } from "@/foundation/ai-traces/ai-traces";
import { ALL_WORKSPACES } from "@/foundation/hooks/use-workspace";
import { LIST_POLL_QUERY_OPTIONS } from "@/foundation/lib/constant";
import { isEndpointPhaseWithdrawn } from "@/foundation/model-reference/endpoint-availability";
import {
  type ModelSource,
  parseStoredModelSource,
  SELF_HOSTED_MODEL_SOURCE,
} from "@/foundation/model-reference/model-source";
import {
  compareWorkspaceModelOptions,
  modelOptionValue,
  useWorkspaceModels,
  type WorkspaceModelOption,
} from "@/foundation/model-reference/use-workspace-models";

// API-key limits live on the key itself: quota + access are a single object
// stored at api_key.spec.limits and read/written via
// three RPCs:
//   create_api_key(..., p_limits)      - create with limits (atomic)
//   get_api_key_limits(p_id)           - config + current-period used/remaining
//   set_api_key_limits(p_id, p_limits) - replace the limits object
// The limits form and its mapping live in lib/api-key-policy-form.ts; the
// shared ApiKeyLimits type comes from the domain's types.ts and trace stats
// from the foundation API layer.

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
      const next = limitsWithDisabled(res.data as ApiKeyLimits, disabled);
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

type InvokableModelRow = {
  model: string;
  type: string;
  endpoint_name: string;
  source_label: string | null;
  // Absent from servers older than the phase column.
  phase?: string | null;
};

/** list_invokable_models rows as picker options; `known` fills what a row lacks. */
export function invokableModelOptions(
  rows: InvokableModelRow[],
  known: WorkspaceModelOption[],
  workspace: string,
): WorkspaceModelOption[] {
  const byValue = new Map(known.map((option) => [option.value, option]));
  const options: WorkspaceModelOption[] = [];
  for (const row of rows) {
    const model = String(row.model ?? "").trim();
    const endpointName = String(row.endpoint_name ?? "").trim();
    if (!model || !endpointName) continue;
    const type = row.type === "external" ? "external" : "internal";
    const value = modelOptionValue(type, endpointName, model);
    const seen = byValue.get(value);
    const phase = row.phase ?? seen?.phase ?? null;
    if (isEndpointPhaseWithdrawn(phase)) continue;
    options.push({
      value,
      label: model,
      model,
      endpointName,
      type,
      source:
        type === "internal"
          ? SELF_HOSTED_MODEL_SOURCE
          : (parseStoredModelSource(row.source_label) ?? seen?.source),
      phase,
      workspace,
    });
  }
  return options.sort(compareWorkspaceModelOptions);
}

// The models an API key may be limited to, from list_invokable_models: it
// needs model:invoke only, so a user who cannot read endpoints still gets a
// list. It is what the key's owner may call, group policy included: the caller
// for a personal key, the application with serviceAccountId. Falls back to the
// endpoint lists for a personal key when the RPC is unavailable.
export function useInvokableModels(
  workspace: string | undefined,
  serviceAccountId?: string,
): WorkspaceModelOption[] {
  const enabled = Boolean(workspace) && workspace !== ALL_WORKSPACES;
  const query = useCustom<InvokableModelRow[]>({
    url: "/rpc/list_invokable_models",
    method: "post",
    config: {
      payload: {
        p_workspace: workspace,
        ...(serviceAccountId === undefined
          ? {}
          : { p_service_account_id: serviceAccountId }),
      },
    },
    queryOptions: { enabled, retry: false, ...LIST_POLL_QUERY_OPTIONS },
    successNotification: false,
    errorNotification: false,
  });
  const known = useWorkspaceModels(workspace);
  const rows = query.data?.data as InvokableModelRow[] | undefined;
  const failed = query.isError;

  return useMemo(() => {
    if (!enabled || !workspace) return [];
    if (rows) return invokableModelOptions(rows, known, workspace);
    return failed && serviceAccountId === undefined ? known : [];
  }, [enabled, workspace, rows, known, failed, serviceAccountId]);
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
/**
 * Source of each allowlist entry, keyed by the row/option `value`
 * ("<type>:<endpoint>:<model>").
 *
 * The source is a property of the MODEL, so it cannot be derived from a row's
 * `type` alone — that only ever yields self-hosted for internal rows and
 * nothing for external ones. It is read from the same workspace options the
 * picker is built from, so every screen showing an allowlist entry agrees.
 */
export function useModelSourceByValue(
  workspace: string | undefined,
): Map<string, string | undefined> {
  const options = useWorkspaceModels(workspace);

  return useMemo(
    () => new Map(options.map((option) => [option.value, option.source])),
    [options],
  );
}

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
            // An empty array is an empty filter (this page has no keys);
            // null means "no filter" and makes the RPC aggregate the whole
            // workspace, which is exactly what this argument exists to avoid.
            p_api_key_ids: apiKeyIds ?? null,
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
