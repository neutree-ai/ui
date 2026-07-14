import { X } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ModelMultiSelect } from "@/domains/api-key/components/ModelMultiSelect";
import {
  isPositiveIntLimit,
  type PolicyModelRow,
  QUOTA_PERIODS,
  useWorkspaceModels,
} from "@/domains/api-key/hooks/use-api-key-policy";
import { FormCombobox } from "@/foundation/components/FormCombobox";
import { FormFieldGroup } from "@/foundation/components/FormFieldGroup";

type ApiKeyPolicyFieldsProps = {
  // The react-hook-form instance whose values include the policy fields.
  // biome-ignore lint/suspicious/noExplicitAny: shared across forms with extra fields.
  form: UseFormReturn<any>;
  // Workspace whose available models populate the allowed-models dropdown.
  workspace: string;
};

// API-key limits editor: Token quota, RPS, RPM, concurrency, allowed models.
// Every limit is optional. Embedded in API key create + edit.
export const ApiKeyPolicyFields = ({
  form,
  workspace,
}: ApiKeyPolicyFieldsProps) => {
  const { t } = useTranslation();
  const modelOptions = useWorkspaceModels(workspace);
  const modelRows = (form.watch("models") as PolicyModelRow[]) ?? [];
  // Split the selected rows into ones the picker can represent (pinned to a
  // currently-served endpoint) and ones it can't — migrated wildcard entries and
  // pins to a now-missing endpoint. The latter are shown as read-only chips and
  // preserved on every change, so editing an unrelated field never drops them.
  const optionValues = new Set(modelOptions.map((o) => o.value));
  const optionsLoaded = modelOptions.length > 0;
  const isPreserved = (r: PolicyModelRow) =>
    !!r.wildcard || (optionsLoaded && !optionValues.has(r.value));
  const preservedRows = modelRows.filter(isPreserved);
  const selectedModels = [
    ...new Set(modelRows.filter((r) => !isPreserved(r)).map((r) => r.value)),
  ];
  // Each numeric limit is optional, but a provided value must be a positive
  // integer (rejects 0 / negatives / decimals) so it can't be silently dropped.
  const positiveIntRule = {
    validate: (v: string) =>
      isPositiveIntLimit(v) || t("api_keys.limits.invalidPositiveInt"),
  };

  return (
    <div className="space-y-3">
      {/* Token quota */}
      <div className="space-y-2 rounded-md border p-3">
        <div className="text-sm font-medium">
          {t("api_keys.limits.quotaTitle")}
        </div>
        <p className="text-xs text-muted-foreground">
          {t("api_keys.limits.quotaHint")}
        </p>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <FormFieldGroup
              {...form}
              name="quota_limit"
              label={t("api_keys.limits.tokenLimit")}
              rules={positiveIntRule}
            >
              <Input
                type="number"
                min={1}
                placeholder={t("api_keys.limits.optional")}
              />
            </FormFieldGroup>
          </div>
          <div className="w-36">
            <FormFieldGroup
              {...form}
              name="quota_period"
              label={t("api_keys.limits.period")}
            >
              <FormCombobox
                options={QUOTA_PERIODS.map((p) => ({
                  label: t(`api_keys.limits.periods.${p}`),
                  value: p,
                }))}
              />
            </FormFieldGroup>
          </div>
        </div>
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

        {/* Allowed models */}
        <div className="space-y-2">
          <span className="text-sm">{t("api_keys.limits.allowedModels")}</span>
          <p className="text-xs text-muted-foreground">
            {t("api_keys.limits.allowedModelsHint")}
          </p>
          <ModelMultiSelect
            options={modelOptions}
            value={selectedModels}
            onChange={(options) =>
              form.setValue(
                "models",
                [
                  ...options.map((option) => ({
                    value: option.value,
                    model: option.model,
                    type: option.type,
                    endpoint_name: option.endpointName,
                  })),
                  ...preservedRows,
                ],
                { shouldDirty: true },
              )
            }
          />
          {preservedRows.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {preservedRows.map((r) => (
                <div
                  key={r.value}
                  className="flex max-w-full items-center gap-1.5 rounded-md border bg-muted/40 py-1 pl-2 pr-1"
                  title={r.model}
                >
                  <span className="truncate max-w-[160px] text-xs font-medium">
                    {r.model}
                  </span>
                  {r.type && r.endpoint_name ? (
                    <>
                      <span className="truncate max-w-[120px] text-xs text-muted-foreground">
                        {r.endpoint_name}
                      </span>
                      <Badge variant="outline" className="h-5 font-normal">
                        {t(`api_keys.models.${r.type}`)}
                      </Badge>
                    </>
                  ) : (
                    <Badge variant="outline" className="h-5 font-normal">
                      {t("api_keys.models.anySource")}
                    </Badge>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      form.setValue(
                        "models",
                        modelRows.filter((x) => x !== r),
                        { shouldDirty: true },
                      )
                    }
                    className="rounded-sm p-0.5 text-muted-foreground hover:bg-muted-foreground/20 hover:text-foreground"
                    aria-label={t("buttons.delete")}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
