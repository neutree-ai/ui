import { useCustomMutation } from "@refinedev/core";
import { useCallback } from "react";

// Unified per-API-key limits editor (NEUTREE-GENERAL-9 UX iteration).
//
// Surfaces both policy resources (quota + access) from the API key create/edit
// flow. Types/constants are declared locally rather than importing the quota /
// access domains, to respect the no-L2-cross-domain architecture rule. The
// underlying RPCs (set_quota_policy / set_access_policy / delete_*) are the same
// the dedicated pages use, scoped to level = api_key.

export const QUOTA_PERIODS = ["daily", "weekly", "monthly", "yearly"] as const;
export type QuotaPeriod = (typeof QUOTA_PERIODS)[number];

export const RATE_WINDOWS = ["second", "minute", "hour", "day"] as const;
export type RateWindow = (typeof RATE_WINDOWS)[number];

export const ENDPOINT_TYPES = ["endpoint", "external_endpoint"] as const;
export type EndpointType = (typeof ENDPOINT_TYPES)[number];

export type PolicyModelRow = { value: string };
export type PolicyEndpointRow = { type: EndpointType; name: string };

// Combined form values for the embedded Limits editor. Every limit is optional.
export type ApiKeyPolicyFormValues = {
  quota_period: QuotaPeriod;
  quota_limit: string;
  rate_limit: string;
  rate_window: RateWindow;
  concurrency: string;
  models: PolicyModelRow[];
  endpoints: PolicyEndpointRow[];
};

export const apiKeyPolicyDefaults = (): ApiKeyPolicyFormValues => ({
  quota_period: "monthly",
  quota_limit: "",
  rate_limit: "",
  rate_window: "minute",
  concurrency: "",
  models: [],
  endpoints: [],
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
  p_rule_type: "rate_limit" | "concurrency" | "model_allowlist" | "endpoint_allowlist";
  p_rule_spec: Record<string, unknown>;
};

// Translate the form values into the set_quota_policy / set_access_policy calls
// for one API key. Pure (unit-tested): only non-empty limits produce a call.
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

  const rl = String(values.rate_limit ?? "").trim();
  if (rl !== "" && Number(rl) > 0) {
    access.push({
      p_level: "api_key",
      p_api_key_id: apiKeyId,
      p_rule_type: "rate_limit",
      p_rule_spec: { limit: Number(rl), window: values.rate_window },
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

  const endpoints = (values.endpoints ?? []).filter((e) => e.type && e.name);
  if (endpoints.length > 0) {
    access.push({
      p_level: "api_key",
      p_api_key_id: apiKeyId,
      p_rule_type: "endpoint_allowlist",
      p_rule_spec: { endpoints },
    });
  }

  return { quota, access };
}

// Apply the embedded Limits form to an API key via the management-plane RPCs.
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
