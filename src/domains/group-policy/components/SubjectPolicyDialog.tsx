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
import { LoadingIcon } from "@/components/ui/loading";
import { TokenPoolSummary } from "@/domains/group-policy/components/GroupModelAccess";
import { ModelEntryList } from "@/domains/group-policy/components/ModelEntryList";
import { ModelEntryPicker } from "@/domains/group-policy/components/ModelEntryPicker";
import { PolicySourceLabel } from "@/domains/group-policy/components/PolicySourceLabel";
import { TokenQuotaFields } from "@/domains/group-policy/components/TokenQuotaFields";
import { useUserGroupPolicy } from "@/domains/group-policy/hooks/use-group-policies";
import { useTokenQuotaInput } from "@/domains/group-policy/hooks/use-token-quota-input";
import {
  addEntries,
  removeEntry,
} from "@/domains/group-policy/lib/model-entries";
import {
  otherPolicyRules,
  tokenPoolSource,
} from "@/domains/group-policy/lib/subject-policy";
import type {
  GroupPolicyModel,
  GroupTokenQuota,
  PolicySubject,
  ScopeSubjectPolicy,
} from "@/domains/group-policy/types";
import { EMPTY_VALUE } from "@/foundation/components/EmptyValue";
import { InactiveBadge } from "@/foundation/components/InactiveBadge";
import { LabelWithHint } from "@/foundation/components/InfoHint";
import { Loader } from "@/foundation/components/Loader";
import { useTranslation } from "@/foundation/lib/i18n";
import type { LabeledScope } from "@/foundation/types/group-scope";

/**
 * Sets the allowed models and token quota of one user or application in a
 * scope, beside the limits already in effect for it. Mount it when opening.
 */
export function SubjectPolicyDialog({
  scope,
  subject,
  policy,
  saving,
  error,
  onOpenChange,
  onSave,
}: {
  scope: LabeledScope;
  subject: PolicySubject;
  /** The subject's row in the scope; its policy fields are null when unset. */
  policy?: ScopeSubjectPolicy;
  saving?: boolean;
  error?: string;
  onOpenChange: (open: boolean) => void;
  onSave: (
    allowed: GroupPolicyModel[],
    tokenQuota: GroupTokenQuota | null,
  ) => void;
}) {
  const { t } = useTranslation();
  const [allowed, setAllowed] = useState(policy?.allowed_models ?? []);
  const quota = useTokenQuotaInput(policy?.token_quota);

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle hint={t("group_policies.subject.dialogHint")}>
            {t("group_policies.subject.dialogTitle", {
              subject: subject.label,
              scope: scope.label,
            })}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <div className="space-y-2">
            <LabelWithHint
              hint={t(`group_policies.subject.allowedHint.${subject.kind}`)}
            >
              {t("group_policies.fields.allowed")}
            </LabelWithHint>
            <ModelEntryList
              entries={allowed}
              onRemove={(entry) => setAllowed(removeEntry(allowed, entry))}
              data-testid="subject-policy-allowed-entries"
            />
            <ModelEntryPicker
              onAdd={(model, workspace) =>
                setAllowed(addEntries(allowed, [model], workspace))
              }
              data-testid="subject-policy-allowed-picker"
            />
          </div>
          <div className="space-y-2">
            <LabelWithHint
              htmlFor="subject-policy-quota-amount"
              hint={t(`group_policies.subject.quotaHint.${subject.kind}`)}
            >
              {t("group_policies.subject.quota")}
            </LabelWithHint>
            <TokenQuotaFields
              input={quota}
              id="subject-policy-quota-amount"
              placeholder={t("group_policies.subject.quotaPlaceholder")}
              testId="subject-policy-quota"
            />
          </div>
          <EffectiveLimits
            subjectId={subject.id}
            scope={scope}
            policyName={policy?.policy_name ?? null}
          />
          {error && (
            <Alert variant="destructive" data-testid="subject-policy-error">
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
            onClick={() => onSave(allowed, quota.quota())}
            data-testid="subject-policy-save"
          >
            {saving && <LoadingIcon className="mr-2" />}
            {t("buttons.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Every pool and every other rule that applies to the subject, as stored.
 * Hidden when the caller may not read the subject's merged policy.
 */
function EffectiveLimits({
  subjectId,
  scope,
  policyName,
}: {
  subjectId: string;
  scope: LabeledScope;
  policyName: string | null;
}) {
  const { t } = useTranslation();
  const { policy, isLoading, denied } = useUserGroupPolicy(
    subjectId,
    null,
    true,
  );
  if (denied) return null;

  const pools = policy?.token_pools ?? [];
  const rules = policy ? otherPolicyRules(policy, policyName) : [];

  return (
    <div
      className="space-y-2 rounded-md border p-3"
      data-testid="subject-effective"
    >
      <LabelWithHint hint={t("group_policies.subject.mergeRules")}>
        {t("group_policies.subject.effectiveTitle")}
      </LabelWithHint>
      {isLoading ? (
        <Loader className="h-4 text-primary" />
      ) : pools.length === 0 && rules.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("group_policies.subject.effectiveNone")}
        </p>
      ) : (
        <ul className="space-y-2 text-sm">
          {pools.map((pool) => {
            const source = tokenPoolSource(pool);
            const own =
              source.owner === "subject" &&
              source.scopeKind === scope.kind &&
              source.scopeName === scope.name;
            return (
              <li
                key={`pool/${pool.kind}/${pool.name}/${pool.scope_kind ?? ""}/${pool.scope_name ?? ""}`}
                className="flex flex-wrap items-start gap-x-3 gap-y-1"
                data-testid="subject-effective-pool"
              >
                <span className="min-w-40 font-medium">
                  <PolicySourceLabel source={source} />
                  {own && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      {t("group_policies.subject.thisScope")}
                    </span>
                  )}
                </span>
                <TokenPoolSummary
                  quota={{ limit: pool.token_limit, period: pool.period }}
                  pool={pool}
                />
              </li>
            );
          })}
          {rules.map((rule) => (
            <li
              key={`rule/${rule.key}`}
              className="flex flex-wrap items-start gap-x-3 gap-y-1"
              data-testid="subject-effective-rule"
            >
              <span className="inline-flex min-w-40 items-center gap-1.5 font-medium">
                <PolicySourceLabel source={rule.source} />
                {!rule.applies && (
                  <InactiveBadge
                    title={t("group_policies.subject.notInScope")}
                  />
                )}
              </span>
              <div className="space-y-1">
                <ModelEntryList
                  entries={rule.allowed}
                  emptyText={rule.denied.length ? undefined : EMPTY_VALUE}
                />
                {rule.denied.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {t("group_policies.fields.denied")}
                    <ModelEntryList entries={rule.denied} />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
