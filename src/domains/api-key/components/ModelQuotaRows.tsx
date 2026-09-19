import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";
import { ThousandsInput } from "@/domains/api-key/components/ThousandsInput";
import type { PolicyModelRow } from "@/domains/api-key/hooks/use-api-key-policy";
import { ModelSourceBadge } from "@/foundation/components/ModelSourceBadge";
import { resolveModelSource } from "@/foundation/lib/model-source";
import {
  DEFAULT_TOKEN_QUOTA_UNIT,
  isValidTokenQuota,
  TOKEN_QUOTA_UNITS,
  type TokenQuotaUnit,
} from "@/foundation/lib/token-quota";
import { cn } from "@/foundation/lib/utils";

// The allowed-model rows of an API key, one per allowlist entry, each with the
// optional per-model token limit hanging off it. This is the "pick the models
// first, then set the quotas" half of the policy form: the limit has nowhere to
// live until a model is on the list, which is also why an empty allowlist can
// only ever use the key's overall quota.
//
// Rows a picker option no longer matches (a migrated any-source entry, or a pin
// to an endpoint that has since gone) are rendered here too rather than as
// read-only chips: they are real allowlist entries and may carry a limit like
// any other. Only their identity is fixed — the picker cannot re-create them,
// so removing one is deliberate.
export const ModelQuotaRows = ({
  rows,
  onChange,
  overlapping,
  quotaPeriodLabel,
}: {
  rows: PolicyModelRow[];
  onChange: (next: PolicyModelRow[]) => void;
  // `value`s of rows that overlap another row of the same model. Overlapping
  // entries cannot be attributed a share of the usage, so the backend rejects
  // them; flagging the rows here is what keeps that out of a submit error.
  overlapping: Set<string>;
  quotaPeriodLabel: string;
}) => {
  const { t } = useTranslation();

  const patch = (row: PolicyModelRow, next: Partial<PolicyModelRow>) =>
    onChange(rows.map((r) => (r === row ? { ...r, ...next } : r)));

  return (
    <div className="divide-y rounded-md border">
      {rows.map((row) => {
        const unit = row.limit_unit ?? DEFAULT_TOKEN_QUOTA_UNIT;
        const amount = row.limit_amount ?? "";
        const overlaps = overlapping.has(row.value);
        const invalidAmount = !isValidTokenQuota(amount, unit);
        return (
          <div
            key={`${row.value}:${row.wildcard ? "any" : "pinned"}`}
            className="flex flex-wrap items-center gap-2 p-2"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{row.model}</div>
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                {row.endpoint_name ? (
                  <span className="truncate max-w-[160px]">
                    {row.endpoint_name}
                  </span>
                ) : null}
                {row.type ? (
                  <ModelSourceBadge source={resolveModelSource(row.type)} />
                ) : (
                  <Badge variant="outline" className="h-5 font-normal">
                    {t("api_keys.models.anySource")}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <ThousandsInput
                className="h-8 w-28"
                aria-label={t("api_keys.limits.perModel.limitLabel", {
                  model: row.model,
                })}
                placeholder={t("api_keys.limits.perModel.unlimited")}
                value={amount}
                onChange={(next) => patch(row, { limit_amount: next })}
              />
              <div className="w-24">
                <Combobox
                  modal
                  value={unit}
                  onChange={(next) =>
                    patch(row, { limit_unit: next as TokenQuotaUnit })
                  }
                  options={TOKEN_QUOTA_UNITS.map((u) => ({
                    label: t(`api_keys.limits.units.${u}`),
                    value: u,
                  }))}
                  triggerClassName="h-8"
                />
              </div>
              <span className="text-xs text-muted-foreground">
                {quotaPeriodLabel}
              </span>
              <button
                type="button"
                onClick={() => onChange(rows.filter((r) => r !== row))}
                className="rounded-sm p-1 text-muted-foreground hover:bg-muted-foreground/20 hover:text-foreground"
                aria-label={t("buttons.delete")}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            {(overlaps || invalidAmount) && (
              <p className={cn("w-full text-xs text-destructive")} role="alert">
                {overlaps
                  ? t("api_keys.limits.perModel.overlap", { model: row.model })
                  : t("api_keys.limits.invalidTokenQuota")}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
};
