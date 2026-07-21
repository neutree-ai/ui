import type { UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { QUOTA_PERIODS } from "@/domains/api-key/hooks/use-api-key-policy";
import { FormCombobox } from "@/foundation/components/FormCombobox";
import { FormFieldGroup } from "@/foundation/components/FormFieldGroup";
import {
  formatThousands,
  isValidTokenQuota,
  TOKEN_QUOTA_UNITS,
} from "@/foundation/lib/token-quota";

// Amount input that re-groups digits with thousands separators as you type
// (10000 → 10,000). Receives value/onChange from FormFieldGroup's cloneElement.
const ThousandsInput = ({
  value,
  onChange,
  ...rest
}: {
  value?: string;
  onChange?: (value: string) => void;
} & Omit<React.ComponentProps<typeof Input>, "value" | "onChange">) => (
  <Input
    {...rest}
    type="text"
    inputMode="decimal"
    value={value ?? ""}
    onChange={(e) => onChange?.(formatThousands(e.target.value))}
  />
);

// Token quota editor: amount + unit (Tokens/K/M/B) + reset period. The token
// count written to the backend is amount × unit; leaving the amount empty means
// no quota.
export const TokenQuotaField = ({
  form,
}: {
  // biome-ignore lint/suspicious/noExplicitAny: shared across forms with extra fields.
  form: UseFormReturn<any>;
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex items-end gap-2">
      <div className="flex-1">
        <FormFieldGroup
          {...form}
          name="quota_limit"
          label={t("api_keys.limits.tokenLimit")}
          // Read the unit fresh at validation time: "1.5" is legal in M but not
          // in Tokens, so validity depends on the current unit selection.
          rules={{
            validate: (v: string) =>
              isValidTokenQuota(v, form.getValues("quota_unit")) ||
              t("api_keys.limits.invalidTokenQuota"),
          }}
        >
          <ThousandsInput placeholder={t("api_keys.limits.optional")} />
        </FormFieldGroup>
      </div>
      <div className="w-32">
        <FormFieldGroup
          {...form}
          name="quota_unit"
          label={t("api_keys.limits.unit")}
          // Changing the unit re-runs the amount's validation (deps), so an
          // amount that just became legal/illegal updates its error immediately.
          rules={{ deps: ["quota_limit"] }}
        >
          <FormCombobox
            options={TOKEN_QUOTA_UNITS.map((u) => ({
              label: t(`api_keys.limits.units.${u}`),
              value: u,
            }))}
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
  );
};
