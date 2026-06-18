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
  type ApiKeyLimits,
  type ApiKeyPolicyFormValues,
  apiKeyPolicyDefaults,
  limitsToForm,
  summarizeApiKeyLimits,
  useApiKeyDisable,
  useApiKeyLimits,
} from "@/domains/api-key/hooks/use-api-key-policy";
import { cn } from "@/foundation/lib/utils";

const fmt = (n: number) => Number(n).toLocaleString();

// Editable Limits panel on the API key detail page: shows the key's current
// limits (a single converged object at spec.limits), its token-quota consumption
// (used / limit / remaining for the current period), and lets you edit the limits
// in place. Save replaces the whole limits object (disabled is preserved).
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
  const [limits, setLimits] = useState<ApiKeyLimits>({});
  const form = useForm<ApiKeyPolicyFormValues>({
    mode: "all",
    defaultValues: apiKeyPolicyDefaults(),
  });

  // Load (and re-load after save) the key's current limits. Keyed only on
  // apiKeyId: load() is stable, but refine's useForm returns a new wrapper object
  // each render, so depending on `form` here would re-run the effect every render
  // and loop the requests.
  // biome-ignore lint/correctness/useExhaustiveDependencies: run once per key.
  const refresh = useCallback(async () => {
    const next = await load(apiKeyId);
    setLimits(next);
    form.reset(limitsToForm(next));
  }, [apiKeyId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const summary = summarizeApiKeyLimits(limits);
  const disabled = !!limits.disabled;
  const [toggling, setToggling] = useState(false);

  const onSave = async (values: FieldValues) => {
    await save(apiKeyId, values as ApiKeyPolicyFormValues, { disabled });
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

  // Token-quota consumption (current period) — computed by get_api_key_limits.
  const quota = limits.token_quota;
  const hasQuota = !!quota?.limit && quota.limit > 0;
  const used = Number(quota?.used ?? 0) || 0;
  const limit = Number(quota?.limit ?? 0) || 0;
  const ratio = hasQuota ? used / limit : 0;
  const pct = Math.max(0, Math.min(100, ratio * 100));
  const over = hasQuota && used >= limit;
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
        {/* Token-quota consumption */}
        {hasQuota && (
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
              {fmt(used)} / {fmt(limit)} {t("api_keys.limits.tokensUnit")} ·{" "}
              {t("api_keys.limits.remainingLabel")}:{" "}
              {fmt(Math.max(0, limit - used))} ·{" "}
              {t(
                `api_keys.limits.periods.${quota?.period ?? "monthly"}`,
              )}
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
