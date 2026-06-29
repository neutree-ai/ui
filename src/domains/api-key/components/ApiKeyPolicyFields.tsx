import type { UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { ModelMultiSelect } from "@/domains/api-key/components/ModelMultiSelect";
import {
  isPositiveIntLimit,
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
  const selectedModels = ((form.watch("models") as { value: string }[]) ?? [])
    .map((m) => m.value)
    .filter(Boolean);
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
            onChange={(vals) =>
              form.setValue(
                "models",
                vals.map((v) => ({ value: v })),
                { shouldDirty: true },
              )
            }
          />
        </div>
      </div>
    </div>
  );
};
