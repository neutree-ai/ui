import { useMemo } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ModelMultiSelect } from "@/domains/api-key/components/ModelMultiSelect";
import { ModelQuotaRows } from "@/domains/api-key/components/ModelQuotaRows";
import { TokenQuotaField } from "@/domains/api-key/components/TokenQuotaField";
import {
  formQuotaGranularity,
  isPositiveIntLimit,
  overlappingModelRowValues,
  type PolicyModelRow,
  resolveQuotaPeriod,
  useWorkspaceModels,
} from "@/domains/api-key/hooks/use-api-key-policy";
import { FormFieldGroup } from "@/foundation/components/FormFieldGroup";
import {
  DEFAULT_TOKEN_QUOTA_UNIT,
  isValidTokenQuota,
} from "@/foundation/lib/token-quota";

type ApiKeyPolicyFieldsProps = {
  // The react-hook-form instance whose values include the policy fields.
  // biome-ignore lint/suspicious/noExplicitAny: shared across forms with extra fields.
  form: UseFormReturn<any>;
  // Workspace whose available models populate the allowed-models dropdown.
  workspace: string;
};

// API-key limits editor: allowed models (each with an optional per-model token
// limit), token quota, RPS, RPM, concurrency. Every limit is optional. Embedded
// in API key create + edit.
//
// Allowed models come first because the quota depends on them: a per-model limit
// hangs off an allowlist entry, so there is nothing to configure until a model
// has been picked, and picking one is what makes the per-model granularity
// available at all.
export const ApiKeyPolicyFields = ({
  form,
  workspace,
}: ApiKeyPolicyFieldsProps) => {
  const { t } = useTranslation();
  const modelOptions = useWorkspaceModels(workspace);
  const sourceByValue = useMemo(
    () => new Map(modelOptions.map((o) => [o.value, o.source])),
    [modelOptions],
  );
  const modelRows = (form.watch("models") as PolicyModelRow[]) ?? [];
  // Rows the picker can represent (pinned to a currently-served endpoint) versus
  // ones it can't — migrated any-source entries and pins to a now-missing
  // endpoint. The latter are not selectable in the dropdown, but they are real
  // allowlist entries: they stay in the row list, keep their limit, and are
  // preserved across every unrelated edit.
  const optionValues = new Set(modelOptions.map((o) => o.value));
  const optionsLoaded = modelOptions.length > 0;
  const isPreserved = (r: PolicyModelRow) =>
    !!r.wildcard || (optionsLoaded && !optionValues.has(r.value));
  const selectedModels = [
    ...new Set(modelRows.filter((r) => !isPreserved(r)).map((r) => r.value)),
  ];
  // Each numeric limit is optional, but a provided value must be a positive
  // integer (rejects 0 / negatives / decimals) so it can't be silently dropped.
  const positiveIntRule = {
    validate: (v: string) =>
      isPositiveIntLimit(v) || t("api_keys.limits.invalidPositiveInt"),
  };

  // Mutual exclusion, derived rather than stored: the moment any allowlist entry
  // carries a limit the key's overall pool stops being enforced, and clearing
  // every entry limit brings it back. The overall quota is kept (greyed out, not
  // erased) so that fallback is one keystroke away.
  const granularity = formQuotaGranularity(modelRows);
  const perModel = granularity === "per_model";
  const overlapping = overlappingModelRowValues(modelRows);
  const quotaPeriodLabel = t(
    `api_keys.limits.periods.${resolveQuotaPeriod(form.watch("quota_period"))}`,
  );

  // Blocks submit on the two things the backend would otherwise reject with a
  // raw SQL error: overlapping entries for a model that carries a limit, and an
  // amount that does not resolve to a whole positive number of tokens.
  const validateModels = (rows: PolicyModelRow[] | undefined) => {
    const all = rows ?? [];
    if (overlappingModelRowValues(all).size > 0) {
      return t("api_keys.limits.perModel.overlapError");
    }
    const invalid = all.some(
      (r) =>
        !isValidTokenQuota(
          r.limit_amount ?? "",
          r.limit_unit ?? DEFAULT_TOKEN_QUOTA_UNIT,
        ),
    );
    return invalid ? t("api_keys.limits.invalidTokenQuota") : true;
  };

  return (
    <div className="space-y-3">
      {/* Allowed models + per-model quota */}
      <div className="space-y-2 rounded-md border p-3">
        <div className="text-sm font-medium">
          {t("api_keys.limits.allowedModels")}
        </div>
        <p className="text-xs text-muted-foreground">
          {t("api_keys.limits.allowedModelsHint")}
        </p>
        <FormField
          control={form.control}
          name="models"
          rules={{ validate: validateModels }}
          render={({ field, fieldState }) => {
            const rows = (field.value as PolicyModelRow[]) ?? [];
            return (
              <div className="space-y-2">
                <ModelMultiSelect
                  options={modelOptions}
                  value={selectedModels}
                  showSelected={false}
                  onChange={(options) => {
                    // Re-selecting keeps each row's existing limit: the picker
                    // only decides membership, never the quota on a row.
                    const byValue = new Map(rows.map((r) => [r.value, r]));
                    field.onChange([
                      ...options.map((option) => ({
                        ...byValue.get(option.value),
                        value: option.value,
                        model: option.model,
                        type: option.type,
                        endpoint_name: option.endpointName,
                      })),
                      ...rows.filter(isPreserved),
                    ]);
                  }}
                />
                {rows.length > 0 ? (
                  <>
                    <ModelQuotaRows
                      sourceByValue={sourceByValue}
                      rows={rows}
                      onChange={field.onChange}
                      overlapping={overlapping}
                      quotaPeriodLabel={quotaPeriodLabel}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("api_keys.limits.perModel.hint")}
                    </p>
                  </>
                ) : (
                  // No entries, so no per-model limit is possible; say why here
                  // rather than leaving the greyed-out overall quota unexplained.
                  <p className="text-xs text-muted-foreground">
                    {t("api_keys.limits.perModel.emptyAllowlist")}
                  </p>
                )}
                {fieldState.error?.message && (
                  <p className="text-sm text-destructive">
                    {fieldState.error.message}
                  </p>
                )}
              </div>
            );
          }}
        />
      </div>

      {/* Token quota */}
      <div className="space-y-2 rounded-md border p-3">
        <div className="text-sm font-medium">
          {t("api_keys.limits.quotaTitle")}
        </div>
        <p className="text-xs text-muted-foreground">
          {perModel
            ? t("api_keys.limits.perModel.overallSuspended")
            : t("api_keys.limits.quotaHint")}
        </p>
        <TokenQuotaField form={form} amountDisabled={perModel} />
      </div>

      {/* Access control */}
      <div className="space-y-3 rounded-md border p-3">
        <div className="text-sm font-medium">
          {t("api_keys.limits.accessTitle")}
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <FormFieldGroup
              {...form}
              name="rps"
              label={t("api_keys.limits.rps")}
              rules={positiveIntRule}
            >
              <Input
                type="number"
                min={1}
                placeholder={t("api_keys.limits.optional")}
              />
            </FormFieldGroup>
          </div>
          <div className="flex-1">
            <FormFieldGroup
              {...form}
              name="rpm"
              label={t("api_keys.limits.rpm")}
              rules={positiveIntRule}
            >
              <Input
                type="number"
                min={1}
                placeholder={t("api_keys.limits.optional")}
              />
            </FormFieldGroup>
          </div>
          <div className="flex-1">
            <FormFieldGroup
              {...form}
              name="concurrency"
              label={t("api_keys.limits.concurrency")}
              rules={positiveIntRule}
            >
              <Input
                type="number"
                min={1}
                placeholder={t("api_keys.limits.optional")}
              />
            </FormFieldGroup>
          </div>
        </div>
      </div>
    </div>
  );
};
