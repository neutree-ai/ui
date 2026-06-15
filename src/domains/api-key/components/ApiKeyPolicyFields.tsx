import { Plus, Trash2 } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QUOTA_PERIODS } from "@/domains/api-key/hooks/use-api-key-policy";
import { FormCombobox } from "@/foundation/components/FormCombobox";
import { FormFieldGroup } from "@/foundation/components/FormFieldGroup";
import { useRefineFieldArray } from "@/foundation/hooks/use-refine-field-array";

type ApiKeyPolicyFieldsProps = {
  // The react-hook-form instance whose values include the policy fields.
  // biome-ignore lint/suspicious/noExplicitAny: shared across forms with extra fields.
  form: UseFormReturn<any>;
};

// API-key limits editor: Token quota, RPS, concurrency, allowed models. Every
// limit is optional. Embedded in API key create + edit.
export const ApiKeyPolicyFields = ({ form }: ApiKeyPolicyFieldsProps) => {
  const { t } = useTranslation();
  const modelsArray = useRefineFieldArray({
    control: form.control,
    name: "models",
  });

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
            >
              <Input
                type="number"
                min={0}
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
            >
              <Input
                type="number"
                min={0}
                placeholder={t("api_keys.limits.optional")}
              />
            </FormFieldGroup>
          </div>
          <div className="flex-1">
            <FormFieldGroup
              {...form}
              name="concurrency"
              label={t("api_keys.limits.concurrency")}
            >
              <Input
                type="number"
                min={0}
                placeholder={t("api_keys.limits.optional")}
              />
            </FormFieldGroup>
          </div>
        </div>

        {/* Allowed models */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm">{t("api_keys.limits.allowedModels")}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => modelsArray.append({ value: "" })}
            >
              <Plus className="mr-1 h-4 w-4" />
              {t("api_keys.limits.addModel")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("api_keys.limits.allowedModelsHint")}
          </p>
          {modelsArray.fields.map((field, index) => (
            <div key={field.id} className="flex items-end gap-2">
              <div className="flex-1">
                <FormFieldGroup
                  {...form}
                  name={`models.${index}.value`}
                  rules={{ required: true }}
                >
                  <Input placeholder={t("api_keys.limits.modelName")} />
                </FormFieldGroup>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mb-1"
                title={t("buttons.delete")}
                onClick={() => modelsArray.remove(index)}
              >
                <Trash2 size={16} />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
