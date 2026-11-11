import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { LoadingIcon } from "@/components/ui/loading";
import { ModelEntryList } from "@/domains/group-policy/components/ModelEntryList";
import { ModelEntryPicker } from "@/domains/group-policy/components/ModelEntryPicker";
import { TokenQuotaFields } from "@/domains/group-policy/components/TokenQuotaFields";
import { useTokenQuotaInput } from "@/domains/group-policy/hooks/use-token-quota-input";
import {
  addEntries,
  removeEntry,
} from "@/domains/group-policy/lib/model-entries";
import type {
  GroupPolicy,
  GroupPolicyModel,
  GroupTokenQuota,
} from "@/domains/group-policy/types";
import { InfoHint, skipInfoHintOnOpen } from "@/foundation/components/InfoHint";
import { useTranslation } from "@/foundation/lib/i18n";

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
  const quota = useTokenQuotaInput(policy?.spec.token_quota);

  const list = (
    id: "allowed" | "denied",
    entries: GroupPolicyModel[],
    setEntries: (next: GroupPolicyModel[]) => void,
  ) => (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        <Label>
          {id === "allowed"
            ? t("group_policies.fields.allowed")
            : t("group_policies.fields.denied")}
        </Label>
        <InfoHint
          label={
            id === "allowed"
              ? t("group_policies.hints.allowed")
              : t("group_policies.hints.denied")
          }
        />
      </div>
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
      <DialogContent
        className="sm:max-w-xl"
        aria-describedby={undefined}
        onOpenAutoFocus={skipInfoHintOnOpen}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1">
            {t("group_policies.editTitle", { group: groupLabel })}
            <InfoHint label={t("group_policies.editHint")} />
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          {list("allowed", allowed, setAllowed)}
          {list("denied", denied, setDenied)}
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label htmlFor="group-policy-pool-amount">
                {t("group_policies.pool.title")}
              </Label>
              <InfoHint label={t("group_policies.pool.hint")} />
            </div>
            <TokenQuotaFields
              input={quota}
              id="group-policy-pool-amount"
              placeholder={t("group_policies.pool.placeholder")}
              testId="group-policy-pool"
            />
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
            disabled={saving || !quota.valid}
            onClick={() => onSave(allowed, denied, quota.quota())}
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
