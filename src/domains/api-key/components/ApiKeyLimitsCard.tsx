import { useCustomMutation } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";
import { useCallback, useEffect, useState } from "react";
import type { FieldValues } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Form } from "@/components/ui/form";
import { ApiKeyPolicyFields } from "@/domains/api-key/components/ApiKeyPolicyFields";
import {
  type AccessRow,
  type ApiKeyPolicyFormValues,
  apiKeyPolicyDefaults,
  policyRowsToForm,
  type QuotaRow,
  summarizeApiKeyLimits,
  useApiKeyDisable,
  useApiKeyLimits,
} from "@/domains/api-key/hooks/use-api-key-policy";
import { cn } from "@/foundation/lib/utils";

const fmt = (n: number) => Number(n).toLocaleString();

type Consumption = { period: string; limit: number; used: number };

// Editable Limits panel on the API key detail page: shows the key's current
// limits, its resource consumption (used / limit / remaining), and lets you edit
// the limits in place (Save upserts changed limits and removes cleared ones).
export const ApiKeyLimitsCard = ({
  apiKeyId,
  workspace,
}: {
  apiKeyId: string;
  workspace: string;
}) => {
  const { t } = useTranslation();
  const { load, save } = useApiKeyLimits();
  const { disable, enable } = useApiKeyDisable();
  const { mutateAsync } = useCustomMutation();
  const [loaded, setLoaded] = useState<{
    quotaRows: QuotaRow[];
    accessRows: AccessRow[];
  }>({ quotaRows: [], accessRows: [] });
  const [consumption, setConsumption] = useState<Consumption | null>(null);
  const form = useForm<ApiKeyPolicyFormValues>({
    mode: "all",
    defaultValues: apiKeyPolicyDefaults(),
  });

  // Load (and re-load after save) the key's current limits + consumption. Keyed
  // only on apiKeyId: load()/mutateAsync and the RHF form's methods are stable,
  // but refine's useForm returns a new wrapper object each render, so depending
  // on `form` here would re-run the effect every render and loop the requests.
  // biome-ignore lint/correctness/useExhaustiveDependencies: run once per key.
  const refresh = useCallback(async () => {
    const rows = await load(apiKeyId);
    setLoaded(rows);
    form.reset(policyRowsToForm(rows.quotaRows, rows.accessRows));
    const quota = rows.quotaRows.find((q) => !q.dimension_type);
    if (quota) {
      try {
        const u = await mutateAsync({
          url: "/rpc/get_quota_scope_usage",
          method: "post",
          values: {
            p_level: "api_key",
            p_period: quota.period,
            p_api_key_id: apiKeyId,
          },
        });
        setConsumption({
          period: quota.period,
          limit: Number(quota.limit_tokens),
          used: Number(u.data ?? 0) || 0,
        });
      } catch {
        setConsumption({
          period: quota.period,
          limit: Number(quota.limit_tokens),
          used: 0,
        });
      }
    } else {
      setConsumption(null);
    }
  }, [apiKeyId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const summary = summarizeApiKeyLimits(loaded.quotaRows, loaded.accessRows);
  const disabled = loaded.accessRows.some((r) => r.rule_type === "disabled");
  const [toggling, setToggling] = useState(false);

  const onSave = async (values: FieldValues) => {
    await save(apiKeyId, values as ApiKeyPolicyFormValues, loaded);
    await refresh();
  };

  const toggleDisabled = async () => {
    setToggling(true);
    try {
      if (disabled) await enable(apiKeyId);
      else await disable(apiKeyId);
      await refresh();
    } finally {
      setToggling(false);
    }
  };

  const ratio =
    consumption && consumption.limit > 0
      ? consumption.used / consumption.limit
      : 0;
  const pct = Math.max(0, Math.min(100, ratio * 100));
  const over = !!consumption && consumption.limit > 0 && consumption.used >= consumption.limit;
  const warn = !over && ratio >= 0.8;

  return (
    <Card className="mt-4">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-xl font-semibold">
            {t("api_keys.limits.sectionTitle")}
          </CardTitle>
          <div className="flex items-center gap-2">
            {disabled ? (
              <Badge variant="destructive">
                {t("api_keys.limits.statusDisabled")}
              </Badge>
            ) : (
              <Badge variant="outline">
                {t("api_keys.limits.statusActive")}
              </Badge>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("api_keys.limits.actions")}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  disabled={toggling}
                  onSelect={(e) => {
                    e.preventDefault();
                    toggleDisabled();
                  }}
                >
                  {disabled
                    ? t("api_keys.limits.enable")
                    : t("api_keys.limits.disable")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Resource consumption */}
        {consumption && (
          <div className="space-y-1">
            <div className="text-sm font-medium">
              {t("api_keys.limits.consumptionTitle")}
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-primary/20">
              <div
                className={cn(
                  "h-full transition-all",
                  over ? "bg-destructive" : warn ? "bg-amber-500" : "bg-primary",
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="text-xs text-muted-foreground">
              {fmt(consumption.used)} / {fmt(consumption.limit)}{" "}
              {t("api_keys.limits.tokensUnit")} ·{" "}
              {t("api_keys.limits.remainingLabel")}:{" "}
              {fmt(Math.max(0, consumption.limit - consumption.used))} ·{" "}
              {t(`api_keys.limits.periods.${consumption.period}`)}
            </div>
          </div>
        )}

        <p className="text-sm text-muted-foreground">
          {summary.length > 0 ? summary.join(" · ") : t("api_keys.limits.none")}
        </p>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSave)} className="space-y-3">
            <ApiKeyPolicyFields form={form} workspace={workspace} />
            <div className="flex justify-end">
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {t("buttons.save")}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};
