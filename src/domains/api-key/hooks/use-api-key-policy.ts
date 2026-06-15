import { useCustomMutation } from "@refinedev/core";
import { useCallback, useEffect, useState } from "react";

// Per-API-key limits (NEUTREE-GENERAL-9 UX). Scoped product decision: the API
// key is the single surface for limits — Token quota, RPS, concurrency, and
// allowed models. Workspace/user levels are out of scope here. Types/constants
// are declared locally (no cross-domain import). Underlying RPCs are the same
// the management plane uses, scoped to level = api_key.

export const QUOTA_PERIODS = ["daily", "weekly", "monthly", "yearly"] as const;
export type QuotaPeriod = (typeof QUOTA_PERIODS)[number];

export type PolicyModelRow = { value: string };

export type ApiKeyPolicyFormValues = {
  quota_period: QuotaPeriod;
  quota_limit: string; // tokens; empty = no quota
  rps: string; // requests/second; empty = no rate limit
  concurrency: string; // max in-flight; empty = no limit
  models: PolicyModelRow[]; // allowed models; empty = unrestricted
};

export const apiKeyPolicyDefaults = (): ApiKeyPolicyFormValues => ({
  quota_period: "monthly",
  quota_limit: "",
  rps: "",
  concurrency: "",
  models: [],
});

type QuotaCall = {
  p_level: "api_key";
  p_api_key_id: string;
  p_period: QuotaPeriod;
  p_limit_tokens: number;
};
type AccessCall = {
  p_level: "api_key";
  p_api_key_id: string;
  p_rule_type: "rate_limit" | "concurrency" | "model_allowlist";
  p_rule_spec: Record<string, unknown>;
};

// Translate the form into set_quota_policy / set_access_policy calls (create
// path). Pure (unit-tested): only non-empty limits produce a call. RPS maps to a
// per-second rate_limit rule.
export function buildApiKeyPolicyParams(
  values: ApiKeyPolicyFormValues,
  apiKeyId: string,
): { quota: QuotaCall[]; access: AccessCall[] } {
  const quota: QuotaCall[] = [];
  const access: AccessCall[] = [];

  const ql = String(values.quota_limit ?? "").trim();
  if (ql !== "" && Number(ql) > 0) {
    quota.push({
      p_level: "api_key",
      p_api_key_id: apiKeyId,
      p_period: values.quota_period,
      p_limit_tokens: Number(ql),
    });
  }

  const rps = String(values.rps ?? "").trim();
  if (rps !== "" && Number(rps) > 0) {
    access.push({
      p_level: "api_key",
      p_api_key_id: apiKeyId,
      p_rule_type: "rate_limit",
      p_rule_spec: { limit: Number(rps), window: "second" },
    });
  }

  const cc = String(values.concurrency ?? "").trim();
  if (cc !== "" && Number(cc) > 0) {
    access.push({
      p_level: "api_key",
      p_api_key_id: apiKeyId,
      p_rule_type: "concurrency",
      p_rule_spec: { max: Number(cc) },
    });
  }

  const models = (values.models ?? [])
    .map((m) => String(m.value ?? "").trim())
    .filter((m) => m !== "");
  if (models.length > 0) {
    access.push({
      p_level: "api_key",
      p_api_key_id: apiKeyId,
      p_rule_type: "model_allowlist",
      p_rule_spec: { models },
    });
  }

  return { quota, access };
}

// Apply limits to a freshly created key (create path: upsert only, no existing
// rows to reconcile).
export function useApplyApiKeyPolicy() {
  const { mutateAsync } = useCustomMutation();
  return useCallback(
    async (apiKeyId: string, values: ApiKeyPolicyFormValues) => {
      const { quota, access } = buildApiKeyPolicyParams(values, apiKeyId);
      for (const q of quota) {
        await mutateAsync({
          url: "/rpc/set_quota_policy",
          method: "post",
          values: q,
        });
      }
      for (const a of access) {
        await mutateAsync({
          url: "/rpc/set_access_policy",
          method: "post",
          values: a,
        });
      }
    },
    [mutateAsync],
  );
}

// Raw policy rows as returned by the read RPCs (only the fields used here).
export type QuotaRow = {
  id: number;
  period: QuotaPeriod;
  limit_tokens: number;
  dimension_type: string | null;
};
export type AccessRow = {
  id: number;
  rule_type: string;
  // biome-ignore lint/suspicious/noExplicitAny: rule_spec shape varies.
  rule_spec: any;
};

// Compact, en-US summary of a key's limits for list/detail display.
export function summarizeApiKeyLimits(
  quotaRows: QuotaRow[],
  accessRows: AccessRow[],
): string[] {
  const periodShort: Record<string, string> = {
    daily: "day",
    weekly: "wk",
    monthly: "mo",
    yearly: "yr",
  };
  const out: string[] = [];
  for (const q of quotaRows) {
    if (q.dimension_type) continue;
    out.push(
      `${Number(q.limit_tokens).toLocaleString()} tok/${periodShort[q.period] ?? q.period}`,
    );
  }
  for (const a of accessRows) {
    if (a.rule_type === "rate_limit") {
      const w = a.rule_spec?.window;
      out.push(w === "second" ? `${a.rule_spec?.limit} RPS` : `${a.rule_spec?.limit}/${w}`);
    } else if (a.rule_type === "concurrency") {
      out.push(`${a.rule_spec?.max} concurrent`);
    } else if (a.rule_type === "model_allowlist") {
      out.push(`models: ${(a.rule_spec?.models ?? []).join(", ")}`);
    } else if (a.rule_type === "endpoint_allowlist") {
      out.push(
        // biome-ignore lint/suspicious/noExplicitAny: endpoint ref shape.
        `endpoints: ${(a.rule_spec?.endpoints ?? []).map((e: any) => `${e.type}:${e.name}`).join(", ")}`,
      );
    }
  }
  return out;
}

// Map a key's current rows into editable form values (for edit prefill).
export function policyRowsToForm(
  quotaRows: QuotaRow[],
  accessRows: AccessRow[],
): ApiKeyPolicyFormValues {
  const v = apiKeyPolicyDefaults();
  const quota = quotaRows.find((q) => !q.dimension_type);
  if (quota) {
    v.quota_period = quota.period;
    v.quota_limit = String(quota.limit_tokens);
  }
  const rps = accessRows.find(
    (a) => a.rule_type === "rate_limit" && a.rule_spec?.window === "second",
  );
  if (rps) v.rps = String(rps.rule_spec?.limit ?? "");
  const cc = accessRows.find((a) => a.rule_type === "concurrency");
  if (cc) v.concurrency = String(cc.rule_spec?.max ?? "");
  const models = accessRows.find((a) => a.rule_type === "model_allowlist");
  if (models)
    v.models = (models.rule_spec?.models ?? []).map((m: string) => ({ value: m }));
  return v;
}

// Bulk: all api_key-level limits the caller can see, grouped by api_key_id, as
// compact summary parts. Used by the API key list to show limits per row.
export function useAllApiKeyLimits(): Map<string, string[]> {
  const { mutateAsync } = useCustomMutation();
  const [byKey, setByKey] = useState<Map<string, string[]>>(new Map());
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [q, a] = await Promise.all([
          mutateAsync({ url: "/rpc/get_quota_policies", method: "post", values: {} }),
          mutateAsync({ url: "/rpc/get_access_policies", method: "post", values: {} }),
        ]);
        const quotaByKey = new Map<string, QuotaRow[]>();
        for (const r of (q.data as (QuotaRow & { level: string; api_key_id: string | null })[]) ?? []) {
          if (r.level !== "api_key" || !r.api_key_id) continue;
          const list = quotaByKey.get(r.api_key_id) ?? [];
          list.push(r);
          quotaByKey.set(r.api_key_id, list);
        }
        const accessByKey = new Map<string, AccessRow[]>();
        for (const r of (a.data as (AccessRow & { level: string; api_key_id: string | null })[]) ?? []) {
          if (r.level !== "api_key" || !r.api_key_id) continue;
          const list = accessByKey.get(r.api_key_id) ?? [];
          list.push(r);
          accessByKey.set(r.api_key_id, list);
        }
        const out = new Map<string, string[]>();
        const ids = new Set([...quotaByKey.keys(), ...accessByKey.keys()]);
        for (const id of ids) {
          out.set(
            id,
            summarizeApiKeyLimits(quotaByKey.get(id) ?? [], accessByKey.get(id) ?? []),
          );
        }
        if (!cancelled) setByKey(out);
      } catch {
        if (!cancelled) setByKey(new Map());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mutateAsync]);
  return byKey;
}

// Load + save a single API key's limits (edit). save() upserts the provided
// limits and deletes the ones cleared (and a stale quota row when the period
// changed), so the form is the source of truth for this key.
export function useApiKeyLimits() {
  const { mutateAsync } = useCustomMutation();

  const load = useCallback(
    async (apiKeyId: string) => {
      const [q, a] = await Promise.all([
        mutateAsync({
          url: "/rpc/get_quota_policies",
          method: "post",
          values: { p_api_key_id: apiKeyId },
        }),
        mutateAsync({
          url: "/rpc/get_access_policies",
          method: "post",
          values: { p_api_key_id: apiKeyId },
        }),
      ]);
      return {
        quotaRows: (q.data as QuotaRow[]) ?? [],
        accessRows: (a.data as AccessRow[]) ?? [],
      };
    },
    [mutateAsync],
  );

  const setQuota = (v: QuotaCall) =>
    mutateAsync({ url: "/rpc/set_quota_policy", method: "post", values: v });
  const setAccess = (v: AccessCall) =>
    mutateAsync({ url: "/rpc/set_access_policy", method: "post", values: v });
  const delQuota = (id: number) =>
    mutateAsync({ url: "/rpc/delete_quota_policy", method: "post", values: { p_id: id } });
  const delAccess = (id: number) =>
    mutateAsync({ url: "/rpc/delete_access_policy", method: "post", values: { p_id: id } });

  const save = useCallback(
    async (
      apiKeyId: string,
      values: ApiKeyPolicyFormValues,
      loaded: { quotaRows: QuotaRow[]; accessRows: AccessRow[] },
    ) => {
      const { quota, access } = buildApiKeyPolicyParams(values, apiKeyId);

      // Quota (single dimension-null row): upsert or delete; remove a stale row
      // when the period changed.
      const curQuota = loaded.quotaRows.find((q) => !q.dimension_type);
      const newQuota = quota[0];
      if (newQuota) {
        await setQuota(newQuota);
        if (curQuota && curQuota.period !== newQuota.p_period) {
          await delQuota(curQuota.id);
        }
      } else if (curQuota) {
        await delQuota(curQuota.id);
      }

      // Access rules by type: upsert provided, delete cleared.
      const want = new Map(access.map((a) => [a.p_rule_type, a]));
      const types: AccessCall["p_rule_type"][] = [
        "rate_limit",
        "concurrency",
        "model_allowlist",
      ];
      for (const ty of types) {
        const w = want.get(ty);
        if (w) {
          await setAccess(w);
        } else {
          const cur = loaded.accessRows.find((r) => r.rule_type === ty);
          if (cur) await delAccess(cur.id);
        }
      }
    },
    // setQuota/setAccess/del* are stable closures over mutateAsync.
    // biome-ignore lint/correctness/useExhaustiveDependencies: mutateAsync only.
    [mutateAsync],
  );

  return { load, save };
}
