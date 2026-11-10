import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TokenPoolSummary } from "@/domains/group-policy/components/GroupModelAccess";
import { SubjectPolicyDialog } from "@/domains/group-policy/components/SubjectPolicyDialog";
import {
  GroupPolicyGoneError,
  useGroupPolicyWrites,
  useScopeSubjectPolicies,
} from "@/domains/group-policy/hooks/use-group-policies";
import { GROUP_POLICY_ERROR_KEYS } from "@/domains/group-policy/lib/group-policy-errors";
import { hasRules } from "@/domains/group-policy/lib/model-entries";
import {
  buildSubjectPolicySpec,
  subjectPolicyChange,
} from "@/domains/group-policy/lib/subject-policy";
import type { PolicyScope, PrincipalKind } from "@/domains/group-policy/types";
import { DeleteConfirmDialog } from "@/foundation/components/DeleteConfirmDialog";
import {
  isPermissionDenied,
  translateApiErrorOr,
} from "@/foundation/lib/api-error-code";
import { useTranslation } from "@/foundation/lib/i18n";
import { formatTokenQuota } from "@/foundation/lib/token-quota";

type ScopePolicyAccess = {
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
};

/**
 * One user's or application's limits in a scope: this scope's allowed models
 * and quota with its usage, what is left across every pool that applies, and
 * the actions the caller may take.
 */
export function SubjectQuotaCell({
  scope,
  subject,
  access,
}: {
  scope: PolicyScope & { label: string };
  subject: { kind: PrincipalKind; id: string; label: string };
  access: ScopePolicyAccess;
}) {
  const { t } = useTranslation();
  // One read per scope: every cell shares the cached answer.
  const { rows, isLoading } = useScopeSubjectPolicies(scope, true);
  const writes = useGroupPolicyWrites();
  const [editing, setEditing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [dialogError, setDialogError] = useState<string>();
  const [actionError, setActionError] = useState<string>();

  if (isLoading) return null;
  const row = rows?.find(
    (candidate) =>
      candidate.subject_kind === subject.kind &&
      candidate.subject_name === subject.id,
  );
  const name = row?.policy_name ?? null;
  const allowedCount = row?.allowed_models?.length ?? 0;
  const effective = row?.effective_remaining ?? null;

  const errorText = (err: unknown) =>
    err instanceof GroupPolicyGoneError
      ? t("group_policies.errors.gone")
      : isPermissionDenied(err)
        ? t("group_policies.subject.denied")
        : translateApiErrorOr(
            t,
            err,
            GROUP_POLICY_ERROR_KEYS,
            "common.errors.unknown",
          );

  return (
    // A row of the applications table opens the application on click; so
    // would a click here, the dialog's included (React events cross portals).
    <div
      className="flex items-start justify-end gap-2 text-left text-sm"
      onClick={(event) => event.stopPropagation()}
      data-testid={`subject-quota-${subject.id}`}
    >
      <div className="min-w-0 flex-1 space-y-1">
        {!hasRules(row) ? (
          <span className="text-muted-foreground">
            {t("group_policies.unrestricted")}
          </span>
        ) : (
          <>
            {allowedCount > 0 && (
              <div
                title={row?.allowed_models
                  ?.map((entry) => entry.model)
                  .join(", ")}
              >
                {t("group_policies.subject.modelsAllowed", {
                  count: allowedCount,
                })}
              </div>
            )}
            {row?.token_quota && (
              <TokenPoolSummary
                quota={row.token_quota}
                pool={
                  row.used === null || row.remaining === null
                    ? undefined
                    : {
                        used: row.used,
                        remaining: row.remaining,
                        resets_at: row.resets_at ?? "",
                      }
                }
              />
            )}
          </>
        )}
        {effective !== null && (
          <div
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
            data-testid="subject-quota-effective"
          >
            {t("group_policies.subject.effectiveRemaining", {
              remaining: formatTokenQuota(Math.max(effective, 0)),
            })}
            {effective <= 0 && (
              <Badge variant="destructive" className="px-1.5 py-0 font-normal">
                {t("group_policies.pool.exhausted")}
              </Badge>
            )}
          </div>
        )}
        {actionError && (
          <p className="text-xs text-destructive">{actionError}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {(name ? access.canUpdate : access.canCreate) && (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            title={t(
              name
                ? "group_policies.subject.edit"
                : "group_policies.subject.set",
            )}
            aria-label={t(
              name
                ? "group_policies.subject.edit"
                : "group_policies.subject.set",
            )}
            data-testid={`subject-quota-edit-${subject.id}`}
            onClick={() => {
              setDialogError(undefined);
              setEditing(true);
            }}
          >
            {name ? (
              <Pencil className="h-3.5 w-3.5" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </Button>
        )}
        {name && access.canDelete && (
          <DeleteConfirmDialog
            allowForceDelete={false}
            open={clearing}
            onOpenChange={setClearing}
            title={t("group_policies.subject.clearTitle")}
            description={t("group_policies.subject.clearHint", {
              subject: subject.label,
              scope: scope.label,
            })}
            okText={t("group_policies.subject.clear")}
            loading={writes.isPending}
            onConfirm={async () => {
              setActionError(undefined);
              try {
                await writes.removeByName(name);
              } catch (err) {
                setActionError(errorText(err));
              }
              setClearing(false);
            }}
          >
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              title={t("group_policies.subject.clear")}
              aria-label={t("group_policies.subject.clear")}
              data-testid={`subject-quota-clear-${subject.id}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </DeleteConfirmDialog>
        )}
      </div>
      {editing && (
        <SubjectPolicyDialog
          scope={scope}
          subject={subject}
          policy={row}
          saving={writes.isPending}
          error={dialogError}
          onOpenChange={(open) => !open && setEditing(false)}
          onSave={async (allowed, tokenQuota) => {
            setDialogError(undefined);
            const spec = buildSubjectPolicySpec(
              subject,
              scope,
              allowed,
              row?.denied_models ?? null,
              tokenQuota,
            );
            try {
              const change = subjectPolicyChange(name, spec);
              if (change === "remove" && name) {
                await writes.removeByName(name);
              } else if (change === "save") {
                await writes.saveByName(name, spec);
              }
              setEditing(false);
            } catch (err) {
              setDialogError(errorText(err));
            }
          }}
        />
      )}
    </div>
  );
}
