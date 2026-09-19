import { useCustomMutation, useInvalidate } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";
import { MoreHorizontal, Power, PowerOff } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { FieldValues } from "react-hook-form";
import { useTranslation } from "react-i18next";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ApiKeyPolicyFields } from "@/domains/api-key/components/ApiKeyPolicyFields";
import { ProjectPicker } from "@/domains/api-key/components/ProjectPicker";
import {
  type ApiKeyPolicyFormValues,
  apiKeyPolicyDefaults,
  buildApiKeyLimits,
  limitsToForm,
  resolveQuotaPeriod,
  useApiKeyDisable,
  useApiKeyLimits,
} from "@/domains/api-key/hooks/use-api-key-policy";
import type { ApiKeyLimits } from "@/domains/api-key/types";
import { FormFieldGroup } from "@/foundation/components/FormFieldGroup";
import { ModelSourceBadge } from "@/foundation/components/ModelSourceBadge";
import { useFormEnterSubmitGuard } from "@/foundation/hooks/use-form-enter-submit-guard";
import { resolveModelSource } from "@/foundation/lib/model-source";
import { formatTokenQuota } from "@/foundation/lib/token-quota";
import { cn } from "@/foundation/lib/utils";

// Editable Limits panel on the API key detail page: shows the key's current
// limits (a single object at spec.limits), its token-quota consumption
// (used / limit / remaining for the current period), and lets you edit the limits
// in place. Save replaces the whole limits object (disabled is preserved).
export const ApiKeyLimitsCard = ({
  apiKeyId,
  workspace,
  projectId,
  displayName,
  description,
  onSaved,
}: {
  apiKeyId: string;
  workspace: string;
  projectId: string | null;
  displayName: string;
  description: string;
  onSaved?: () => unknown;
}) => {
  const { t } = useTranslation();
  const { load } = useApiKeyLimits();
  const { disable, enable } = useApiKeyDisable();
  const { mutateAsync } = useCustomMutation();
  const invalidate = useInvalidate();
  const onKeyDown = useFormEnterSubmitGuard();
  const [limits, setLimits] = useState<ApiKeyLimits>({});
  const form = useForm<
    ApiKeyPolicyFormValues & {
      project_id: string;
      display_name: string;
      description: string;
    }
  >({
    mode: "all",
    defaultValues: {
      ...apiKeyPolicyDefaults(),
      project_id: projectId ?? "",
      display_name: displayName,
      description,
    },
  });

  // Load (and re-load after save) the key's current limits. Keyed only on
  // apiKeyId: load() is stable, but refine's useForm returns a new wrapper object
  // each render, so depending on `form` here would re-run the effect every render
  // and loop the requests.
  // biome-ignore lint/correctness/useExhaustiveDependencies: run once per key.
  const refresh = useCallback(async () => {
    const next = await load(apiKeyId);
    setLimits(next);
    form.reset({
      ...limitsToForm(next),
      project_id: projectId ?? "",
      display_name: displayName,
      description,
    });
  }, [apiKeyId, projectId, displayName, description]);

  useEffect(() => {
    // Load failures (network/auth) just leave the default empty state; swallow
    // so they don't surface as an unhandled promise rejection.
    refresh().catch(() => {});
  }, [refresh]);

  const disabled = !!limits.disabled;
  const [toggling, setToggling] = useState(false);

  const onSave = async (values: FieldValues) => {
    await mutateAsync({
      url: "/rpc/update_api_key_configuration",
      method: "post",
      values: {
        p_api_key_id: apiKeyId,
        p_project_id: values.project_id || null,
        p_display_name: values.display_name,
        p_description: values.description,
        p_limits: buildApiKeyLimits(values as ApiKeyPolicyFormValues, {
          disabled,
        }),
      },
    });
    await invalidate({
      resource: "api_keys",
      invalidates: ["list", "detail"],
    });
    await onSaved?.();
    const next = await load(apiKeyId);
    setLimits(next);
    form.reset({
      ...limitsToForm(next),
      project_id: values.project_id,
      display_name: values.display_name,
      description: values.description,
    });
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

  // Which quota is actually in force. Read it from the granularity the backend
  // derived, never from whether token_quota exists: token_quota is deliberately
  // retained in per-model mode so clearing the entry limits falls back to it,
  // and showing it there would be a second, unenforced readout.
  const granularity = limits.quota_granularity ?? "overall";
  // Clamp the period to a known value so the i18n lookup never renders the raw
  // key when the backend returns an unexpected period.
  const period = resolveQuotaPeriod(
    limits.quota_period ?? limits.token_quota?.period,
  );

  // Token-quota consumption (current period) — computed by get_api_key_limits.
  const quota = limits.token_quota;
  const hasQuota =
    granularity === "overall" && !!quota?.limit && quota.limit > 0;
  const used = Number(quota?.used ?? 0) || 0;
  const limit = Number(quota?.limit ?? 0) || 0;
  // Prefer the backend-computed remaining (source of truth; may be negative to
  // convey overage); fall back to limit - used when it isn't provided.
  const remaining =
    typeof quota?.remaining === "number" ? quota.remaining : limit - used;
  const ratio = hasQuota ? used / limit : 0;
  const pct = Math.max(0, Math.min(100, ratio * 100));
  const over = hasQuota && used >= limit;
  const warn = !over && ratio >= 0.8;

  // Per-model consumption: one row per allowlist entry that carries a limit.
  // Entries without one are unlimited and carry no used/remaining at all, so
  // they get no readout here — the editor below still lists them.
  const perModelEntries =
    granularity === "per_model"
      ? (limits.allowed_models ?? []).filter(
          (m) => typeof m.token_limit === "number",
        )
      : [];

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSave)}
        onKeyDown={onKeyDown}
        className="mt-4 space-y-4"
      >
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xl font-semibold">
              {t("api_keys.detailsTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormFieldGroup
              {...form}
              name="display_name"
              label={t("api_keys.fields.displayName")}
              rules={{
                required: t("api_keys.messages.nameRequired"),
                maxLength: {
                  value: 63,
                  message: t("api_keys.messages.nameTooLong"),
                },
                validate: (value) =>
                  value.trim().length > 0 ||
                  t("api_keys.messages.nameRequired"),
              }}
            >
              <Input />
            </FormFieldGroup>
            <FormFieldGroup
              {...form}
              name="description"
              label={t("api_keys.fields.description")}
            >
              <Textarea />
            </FormFieldGroup>
            <FormFieldGroup
              {...form}
              name="project_id"
              label={t("api_keys.fields.project")}
            >
              <ProjectPicker
                workspace={workspace}
                value={form.watch("project_id")}
                onChange={(id) =>
                  form.setValue("project_id", id, { shouldValidate: true })
                }
              />
            </FormFieldGroup>
          </CardContent>
        </Card>
        <Card>
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
                        void toggleDisabled().catch(() => {});
                      }}
                    >
                      {disabled ? (
                        <Power className="mr-2 h-4 w-4" />
                      ) : (
                        <PowerOff className="mr-2 h-4 w-4" />
                      )}
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
            {/* Per-model consumption (current period) */}
            {perModelEntries.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium">
                  {t("api_keys.limits.perModel.consumptionTitle")}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-muted-foreground">
                      <tr className="text-left">
                        <th className="py-1 pr-3 font-normal">
                          {t("api_keys.fields.model")}
                        </th>
                        <th className="py-1 pr-3 font-normal">
                          {t("api_keys.limits.perModel.limitColumn")}
                        </th>
                        <th className="py-1 pr-3 font-normal">
                          {t("api_keys.limits.perModel.usedColumn")}
                        </th>
                        <th className="py-1 pr-3 font-normal">
                          {t("api_keys.limits.perModel.remainingColumn")}
                        </th>
                        <th className="py-1 font-normal">
                          {t("api_keys.limits.period")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {perModelEntries.map((entry) => {
                        const entryUsed = Number(entry.used ?? 0) || 0;
                        const entryLimit = Number(entry.token_limit ?? 0) || 0;
                        // remaining is authoritative and may be negative: a soft
                        // quota can be overshot before enforcement catches up.
                        const entryRemaining =
                          typeof entry.remaining === "number"
                            ? entry.remaining
                            : entryLimit - entryUsed;
                        const exhausted = entryRemaining <= 0;
                        return (
                          <tr
                            key={`${entry.type ?? ""}|${entry.endpoint_name ?? ""}|${entry.model}`}
                            className="border-t"
                          >
                            <td className="py-1.5 pr-3">
                              <div className="font-medium">{entry.model}</div>
                              <div className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
                                {entry.endpoint_name ? (
                                  <span>{entry.endpoint_name}</span>
                                ) : null}
                                {entry.type ? (
                                  <ModelSourceBadge
                                    source={resolveModelSource(entry.type)}
                                  />
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className="h-5 font-normal"
                                  >
                                    {t("api_keys.models.anySource")}
                                  </Badge>
                                )}
                              </div>
                            </td>
                            <td className="py-1.5 pr-3 tabular-nums">
                              {formatTokenQuota(entryLimit)}
                            </td>
                            <td className="py-1.5 pr-3 tabular-nums">
                              {formatTokenQuota(entryUsed)}
                            </td>
                            <td
                              className={cn(
                                "py-1.5 pr-3 tabular-nums",
                                exhausted && "text-destructive",
                              )}
                            >
                              {exhausted
                                ? t("api_keys.limits.perModel.exhausted", {
                                    amount: formatTokenQuota(entryRemaining),
                                  })
                                : formatTokenQuota(entryRemaining)}
                            </td>
                            <td className="py-1.5">
                              {t(`api_keys.limits.periods.${period}`)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("api_keys.limits.perModel.softQuotaNote")}
                </p>
              </div>
            )}

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
                      over
                        ? "bg-destructive"
                        : warn
                          ? "bg-amber-500"
                          : "bg-primary",
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatTokenQuota(used)} / {formatTokenQuota(limit)}{" "}
                  {t("api_keys.limits.tokensUnit")} ·{" "}
                  {t("api_keys.limits.remainingLabel")}:{" "}
                  {formatTokenQuota(remaining)} ·{" "}
                  {t(`api_keys.limits.periods.${period}`)}
                </div>
              </div>
            )}

            <ApiKeyPolicyFields form={form} workspace={workspace} />
            <div className="flex justify-end">
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {t("buttons.save")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </Form>
  );
};
