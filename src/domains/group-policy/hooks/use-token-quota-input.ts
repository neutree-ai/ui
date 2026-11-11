import { useState } from "react";
import type {
  GroupTokenPoolPeriod,
  GroupTokenQuota,
} from "@/domains/group-policy/types";
import {
  DEFAULT_TOKEN_QUOTA_UNIT,
  formatThousands,
  isValidTokenQuota,
  splitTokenQuota,
  type TokenQuotaUnit,
  toTokenCount,
} from "@/foundation/lib/token-quota";

/** The amount, unit and period of a token quota being edited; empty amount: none. */
export const useTokenQuotaInput = (
  stored: GroupTokenQuota | null | undefined,
) => {
  const split = stored ? splitTokenQuota(stored.limit) : undefined;
  const [amount, setAmount] = useState(
    split ? formatThousands(String(split.amount)) : "",
  );
  const [unit, setUnit] = useState<TokenQuotaUnit>(
    split?.unit ?? DEFAULT_TOKEN_QUOTA_UNIT,
  );
  const [period, setPeriod] = useState<GroupTokenPoolPeriod>(
    stored?.period ?? "monthly",
  );
  return {
    amount,
    /** Takes the amount as ThousandsInput formats it. */
    setAmount,
    unit,
    setUnit,
    period,
    setPeriod,
    valid: isValidTokenQuota(amount, unit),
    quota: (): GroupTokenQuota | null => {
      const limit = toTokenCount(amount, unit);
      return limit === null ? null : { limit, period };
    },
  };
};

export type TokenQuotaInput = ReturnType<typeof useTokenQuotaInput>;
