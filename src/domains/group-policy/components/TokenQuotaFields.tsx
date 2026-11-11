import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TokenQuotaInput } from "@/domains/group-policy/hooks/use-token-quota-input";
import type { GroupTokenPoolPeriod } from "@/domains/group-policy/types";
import { ThousandsInput } from "@/foundation/components/ThousandsInput";
import { useTranslation } from "@/foundation/lib/i18n";
import {
  QUOTA_PERIODS,
  TOKEN_QUOTA_UNITS,
  type TokenQuotaUnit,
} from "@/foundation/lib/token-quota";

/** Amount, unit and period of a token quota; `testId` prefixes each control. */
export function TokenQuotaFields({
  input,
  id,
  placeholder,
  testId,
}: {
  input: TokenQuotaInput;
  /** The amount input's id, for its label. */
  id: string;
  placeholder: string;
  testId: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-start gap-2">
      <div className="flex-1">
        <ThousandsInput
          id={id}
          value={input.amount}
          placeholder={placeholder}
          onChange={input.setAmount}
          aria-invalid={!input.valid}
          data-testid={`${testId}-amount`}
        />
        {!input.valid && (
          <p className="mt-1 text-xs text-destructive">
            {t("group_policies.pool.invalid")}
          </p>
        )}
      </div>
      <Select
        value={input.unit}
        onValueChange={(v) => input.setUnit(v as TokenQuotaUnit)}
      >
        <SelectTrigger
          className="w-28"
          aria-label={t("api_keys.limits.unit")}
          data-testid={`${testId}-unit`}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TOKEN_QUOTA_UNITS.map((u) => (
            <SelectItem key={u} value={u}>
              {t(`api_keys.limits.units.${u}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={input.period}
        onValueChange={(v) => input.setPeriod(v as GroupTokenPoolPeriod)}
      >
        <SelectTrigger
          className="w-32"
          aria-label={t("api_keys.limits.period")}
          data-testid={`${testId}-period`}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {QUOTA_PERIODS.map((p) => (
            <SelectItem key={p} value={p}>
              {t(`api_keys.limits.periods.${p}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
