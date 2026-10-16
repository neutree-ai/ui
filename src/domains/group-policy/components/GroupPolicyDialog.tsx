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
import { Label } from "@/components/ui/label";
import { LoadingIcon } from "@/components/ui/loading";
import { ModelEntryList } from "@/domains/group-policy/components/ModelEntryList";
import { ModelEntryPicker } from "@/domains/group-policy/components/ModelEntryPicker";
import {
  addEntries,
  removeEntry,
} from "@/domains/group-policy/lib/model-entries";
import type {
  GroupPolicy,
  GroupPolicyModel,
} from "@/domains/group-policy/types";
import { useTranslation } from "@/foundation/lib/i18n";

/** Edits both lists of a group's policy. Mount it when opening. */
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
  onSave: (allowed: GroupPolicyModel[], denied: GroupPolicyModel[]) => void;
}) {
  const { t } = useTranslation();
  const [allowed, setAllowed] = useState(policy?.spec.allowed_models ?? []);
  const [denied, setDenied] = useState(policy?.spec.denied_models ?? []);

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
            disabled={saving}
            onClick={() => onSave(allowed, denied)}
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
