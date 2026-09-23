import type { UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { ThousandsInput } from "@/domains/api-key/components/ThousandsInput";
import { QUOTA_PERIODS } from "@/domains/api-key/hooks/use-api-key-policy";
import { FormCombobox } from "@/foundation/components/FormCombobox";
import { FormFieldGroup } from "@/foundation/components/FormFieldGroup";
import {
  isValidTokenQuota,
  TOKEN_QUOTA_UNITS,
} from "@/foundation/lib/token-quota";

// Token quota editor: amount + unit (Tokens/K/M/B) + reset period. The token
// count written to the backend is amount × unit; leaving the amount empty means
// no quota.
//
// `amountDisabled` greys out the amount and unit while a per-model limit is in
// force: the two granularities are mutually exclusive, so the overall pool is
// not enforced then. The period stays editable — it is the key's single quota
// period and the per-model limits reset on it too.
export const TokenQuotaField = ({
  form,
  amountDisabled = false,
}: {
  // biome-ignore lint/suspicious/noExplicitAny: shared across forms with extra fields.
  form: UseFormReturn<any>;
  amountDisabled?: boolean;
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
              amountDisabled ||
              isValidTokenQuota(v, form.getValues("quota_unit")) ||
              t("api_keys.limits.invalidTokenQuota"),
          }}
        >
          <ThousandsInput
            disabled={amountDisabled}
            placeholder={t("api_keys.limits.optional")}
          />
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
            disabled={amountDisabled}
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
