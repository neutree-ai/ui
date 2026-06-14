import { useCustomMutation } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";
import { Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { FieldValues } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { ApiKeyPolicyFields } from "@/domains/api-key/components/ApiKeyPolicyFields";
import {
  type ApiKeyPolicyFormValues,
  apiKeyPolicyDefaults,
  useApplyApiKeyPolicy,
} from "@/domains/api-key/hooks/use-api-key-policy";

type QuotaRow = {
  id: number;
  period: string;
  limit_tokens: number;
  dimension_type: string | null;
  dimension_value: string | null;
};
type AccessRow = {
  id: number;
  rule_type: string;
  // biome-ignore lint/suspicious/noExplicitAny: rule_spec shape varies by rule_type.
  rule_spec: any;
};

// Per-API-key Limits panel for the show page: lists the key's current quota +
// access rules (with delete) and an inline editor to add more. Same RPCs as the
// dedicated Quota / Access pages, scoped to this api_key.
export const ApiKeyLimitsCard = ({
  apiKeyId,
  workspace,
}: {
  apiKeyId: string;
  workspace: string;
}) => {
  const { t } = useTranslation();
  const { mutateAsync } = useCustomMutation();
  const applyPolicy = useApplyApiKeyPolicy();
  const [quotaRows, setQuotaRows] = useState<QuotaRow[]>([]);
  const [accessRows, setAccessRows] = useState<AccessRow[]>([]);
  const form = useForm<ApiKeyPolicyFormValues>({
    mode: "all",
    defaultValues: apiKeyPolicyDefaults(),
  });

  const load = useCallback(async () => {
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
    setQuotaRows((q.data as QuotaRow[]) ?? []);
    setAccessRows((a.data as AccessRow[]) ?? []);
  }, [mutateAsync, apiKeyId]);

  useEffect(() => {
    load();
  }, [load]);

  const quotaSummary = (r: QuotaRow) => {
    const base = `${t(`api_keys.limits.periods.${r.period}`)}: ${Number(
      r.limit_tokens,
    ).toLocaleString()} ${t("api_keys.limits.tokensUnit")}`;
    return r.dimension_type ? `${base} (${r.dimension_type}:${r.dimension_value})` : base;
  };
  const accessSummary = (r: AccessRow) => {
    if (r.rule_type === "concurrency") {
      return t("api_keys.limits.summary.concurrency", { max: r.rule_spec?.max ?? "-" });
    }
    if (r.rule_type === "rate_limit") {
      return t("api_keys.limits.summary.rate", {
        limit: r.rule_spec?.limit ?? "-",
        window: t(`api_keys.limits.windows.${r.rule_spec?.window ?? "minute"}`),
      });
    }
    if (r.rule_type === "model_allowlist") {
      return t("api_keys.limits.summary.models", {
        models: (r.rule_spec?.models ?? []).join(", ") || "-",
      });
    }
    if (r.rule_type === "endpoint_allowlist") {
      return t("api_keys.limits.summary.endpoints", {
        endpoints:
          (r.rule_spec?.endpoints ?? [])
            // biome-ignore lint/suspicious/noExplicitAny: endpoint ref shape.
            .map((e: any) => `${e.type}:${e.name}`)
            .join(", ") || "-",
      });
    }
    return r.rule_type;
  };

  const deleteQuota = async (id: number) => {
    await mutateAsync({
      url: "/rpc/delete_quota_policy",
      method: "post",
      values: { p_id: id },
    });
    await load();
  };
  const deleteAccess = async (id: number) => {
    await mutateAsync({
      url: "/rpc/delete_access_policy",
      method: "post",
      values: { p_id: id },
    });
    await load();
  };

  const onAdd = async (values: FieldValues) => {
    await applyPolicy(apiKeyId, values as ApiKeyPolicyFormValues);
    form.reset(apiKeyPolicyDefaults());
    await load();
  };

  const hasRules = quotaRows.length > 0 || accessRows.length > 0;

  return (
    <Card className="mt-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl font-semibold">
          {t("api_keys.limits.sectionTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          {!hasRules && (
            <p className="text-sm text-muted-foreground">
              {t("api_keys.limits.none")}
            </p>
          )}
          {quotaRows.map((r) => (
            <div key={`q${r.id}`} className="flex items-center gap-3 py-1">
              <Badge variant="secondary">{t("api_keys.limits.quotaTag")}</Badge>
              <span className="flex-1 text-sm">{quotaSummary(r)}</span>
              <Button
                variant="ghost"
                size="icon"
                title={t("buttons.delete")}
                onClick={() => deleteQuota(r.id)}
              >
                <Trash2 size={16} />
              </Button>
            </div>
          ))}
          {accessRows.map((r) => (
            <div key={`a${r.id}`} className="flex items-center gap-3 py-1">
              <Badge variant="outline">
                {t(`api_keys.limits.ruleTypes.${r.rule_type}`)}
              </Badge>
              <span className="flex-1 text-sm">{accessSummary(r)}</span>
              <Button
                variant="ghost"
                size="icon"
                title={t("buttons.delete")}
                onClick={() => deleteAccess(r.id)}
              >
                <Trash2 size={16} />
              </Button>
            </div>
          ))}
        </div>

        <div className="rounded-md border p-3">
          <div className="mb-2 text-sm font-medium">
            {t("api_keys.limits.addTitle")}
          </div>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onAdd)} className="space-y-3">
              <ApiKeyPolicyFields form={form} workspace={workspace} />
              <div className="flex justify-end">
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {t("api_keys.limits.add")}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </CardContent>
    </Card>
  );
};
