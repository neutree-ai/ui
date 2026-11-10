import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingIcon } from "@/components/ui/loading";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ModelEntryList } from "@/domains/group-policy/components/ModelEntryList";
import { ModelEntryPicker } from "@/domains/group-policy/components/ModelEntryPicker";
import {
  addEntries,
  removeEntry,
} from "@/domains/group-policy/lib/model-entries";
import type {
  GroupPolicy,
  GroupPolicyModel,
  GroupTokenPoolPeriod,
  GroupTokenQuota,
} from "@/domains/group-policy/types";
import { useTranslation } from "@/foundation/lib/i18n";
import {
  DEFAULT_TOKEN_QUOTA_UNIT,
  formatThousands,
  isValidTokenQuota,
  splitTokenQuota,
  TOKEN_QUOTA_UNITS,
  type TokenQuotaUnit,
  toTokenCount,
} from "@/foundation/lib/token-quota";

const POOL_PERIODS: GroupTokenPoolPeriod[] = [
  "daily",
  "weekly",
  "monthly",
  "yearly",
];

/** Edits the lists and the token pool of a group's policy. Mount it when opening. */
export function GroupPolicyDialog({
  policy,
  groupLabel,
  saving,
  error,
  onOpenChange,
  onSave,
}: {
  policy?: GroupPolicy;
  groupLabel: string;
  saving?: boolean;
  error?: string;
  onOpenChange: (open: boolean) => void;
  onSave: (
    allowed: GroupPolicyModel[],
    denied: GroupPolicyModel[],
    tokenQuota: GroupTokenQuota | null,
  ) => void;
}) {
  const { t } = useTranslation();
  const [allowed, setAllowed] = useState(policy?.spec.allowed_models ?? []);
  const [denied, setDenied] = useState(policy?.spec.denied_models ?? []);
  const stored = policy?.spec.token_quota;
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
  const amountValid = isValidTokenQuota(amount, unit);
  const tokenQuota = (): GroupTokenQuota | null => {
    const limit = toTokenCount(amount, unit);
    return limit === null ? null : { limit, period };
  };

  const list = (
    id: "allowed" | "denied",
    entries: GroupPolicyModel[],
    setEntries: (next: GroupPolicyModel[]) => void,
  ) => (
    <div className="space-y-2">
      <Label>
        {id === "allowed"
          ? t("group_policies.fields.allowed")
          : t("group_policies.fields.denied")}
      </Label>
      <p className="text-xs text-muted-foreground">
        {id === "allowed"
          ? t("group_policies.hints.allowed")
          : t("group_policies.hints.denied")}
      </p>
      <ModelEntryList
        entries={entries}
        onRemove={(entry) => setEntries(removeEntry(entries, entry))}
        emptyText={t("group_policies.noRule")}
        data-testid={`group-policy-${id}-entries`}
      />
      <ModelEntryPicker
        onAdd={(model, workspace) =>
          setEntries(addEntries(entries, [model], workspace))
        }
        data-testid={`group-policy-${id}-picker`}
      />
    </div>
  );

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {t("group_policies.editTitle", { group: groupLabel })}
          </DialogTitle>
          <DialogDescription>{t("group_policies.editHint")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          {list("allowed", allowed, setAllowed)}
          {list("denied", denied, setDenied)}
          <div className="space-y-2">
            <Label htmlFor="group-policy-pool-amount">
              {t("group_policies.pool.title")}
            </Label>
            <p className="text-xs text-muted-foreground">
              {t("group_policies.pool.hint")}
            </p>
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <Input
                  id="group-policy-pool-amount"
                  inputMode="decimal"
                  value={amount}
                  placeholder={t("group_policies.pool.placeholder")}
                  onChange={(e) => setAmount(formatThousands(e.target.value))}
                  aria-invalid={!amountValid}
                  data-testid="group-policy-pool-amount"
                />
                {!amountValid && (
                  <p className="mt-1 text-xs text-destructive">
                    {t("group_policies.pool.invalid")}
                  </p>
                )}
              </div>
              <Select
                value={unit}
                onValueChange={(v) => setUnit(v as TokenQuotaUnit)}
              >
                <SelectTrigger
                  className="w-28"
                  aria-label={t("api_keys.limits.unit")}
                  data-testid="group-policy-pool-unit"
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
                value={period}
                onValueChange={(v) => setPeriod(v as GroupTokenPoolPeriod)}
              >
                <SelectTrigger
                  className="w-32"
                  aria-label={t("api_keys.limits.period")}
                  data-testid="group-policy-pool-period"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POOL_PERIODS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {t(`api_keys.limits.periods.${p}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {error && (
            <Alert variant="destructive" data-testid="group-policy-error">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("buttons.cancel")}
          </Button>
          <Button
            type="button"
            disabled={saving || !amountValid}
            onClick={() => onSave(allowed, denied, tokenQuota())}
            data-testid="group-policy-save"
          >
            {saving && <LoadingIcon className="mr-2" />}
            {t("buttons.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
