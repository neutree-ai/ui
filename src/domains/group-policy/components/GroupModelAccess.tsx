import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GroupPolicyDialog } from "@/domains/group-policy/components/GroupPolicyDialog";
import { ModelEntryList } from "@/domains/group-policy/components/ModelEntryList";
import {
  GroupPolicyGoneError,
  useGroupPolicy,
  useGroupPolicyWrites,
  useGroupTokenPool,
} from "@/domains/group-policy/hooks/use-group-policies";
import { groupPolicyErrorMessage } from "@/domains/group-policy/lib/group-policy-errors";
import {
  buildGroupPolicySpec,
  hasRules,
} from "@/domains/group-policy/lib/model-entries";
import type {
  GroupPolicySubjectKind,
  GroupTokenPool,
  GroupTokenQuota,
} from "@/domains/group-policy/types";
import { ConfirmDialog } from "@/foundation/components/ConfirmDialog";
import { Loader } from "@/foundation/components/Loader";
import { ShowPage } from "@/foundation/components/ShowPage";
import { useHasGlobalPermission } from "@/foundation/hooks/use-has-permission";
import { getErrorMessage } from "@/foundation/lib/error-message";
import { useTranslation } from "@/foundation/lib/i18n";
import { formatTokenQuota } from "@/foundation/lib/token-quota";

/** Limit, period and, when read, the usage of the current period. */
export function TokenPoolSummary({
  quota,
  pool,
}: {
  quota: GroupTokenQuota;
  pool?: Pick<GroupTokenPool, "used" | "remaining" | "resets_at">;
}) {
  const { t } = useTranslation();
  const period = t(`api_keys.limits.periods.${quota.period}`);
  return (
    <div className="space-y-1" data-testid="group-policy-pool">
      <div className="flex flex-wrap items-center gap-1.5">
        <span>
          {t("group_policies.pool.limit", {
            limit: formatTokenQuota(quota.limit),
            period,
          })}
        </span>
        {pool && pool.remaining <= 0 && (
          <Badge variant="destructive" className="px-1.5 py-0 font-normal">
            {t("group_policies.pool.exhausted")}
          </Badge>
        )}
      </div>
      {pool && (
        <p
          className="text-xs text-muted-foreground"
          data-testid="group-policy-pool-usage"
        >
          {t("group_policies.pool.usage", {
            used: formatTokenQuota(pool.used),
            remaining: formatTokenQuota(Math.max(pool.remaining, 0)),
            resetsAt: pool.resets_at,
          })}
        </p>
      )}
    </div>
  );
}

/**
 * The model access policy of a Team or a department. Policies are Neutree
 * data, so synced groups take one too. Global group_policy:* only.
 */
export function GroupModelAccess({
  kind,
  name,
  label,
}: {
  kind: GroupPolicySubjectKind;
  name: string;
  /** The group's display name; defaults to the name. */
  label?: string;
}) {
  const { t } = useTranslation();
  const canRead = useHasGlobalPermission("group_policy:read").allowed === true;
  const canCreate =
    useHasGlobalPermission("group_policy:create").allowed === true;
  const canUpdate =
    useHasGlobalPermission("group_policy:update").allowed === true;
  const canDelete =
    useHasGlobalPermission("group_policy:delete").allowed === true;
  const { policy, isLoading, error } = useGroupPolicy(kind, name, canRead);
  const tokenQuota = policy?.spec.token_quota ?? null;
  const pool = useGroupTokenPool(kind, name, canRead && tokenQuota !== null);
  const writes = useGroupPolicyWrites();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [dialogError, setDialogError] = useState<string>();
  const [actionError, setActionError] = useState<string>();

  if (!canRead) return null;

  const errorText = (err: unknown) =>
    err instanceof GroupPolicyGoneError
      ? t("group_policies.errors.gone")
      : (groupPolicyErrorMessage(t, err) ??
        getErrorMessage(err, t("common.errors.unknown")));

  const canEdit = policy ? canUpdate : canCreate;
  const allowed = policy?.spec.allowed_models ?? [];
  const denied = policy?.spec.denied_models ?? [];

  return (
    <ShowPage.Section
      title={t("group_policies.title")}
      description={t(
        kind === "Team"
          ? "group_policies.groupHint.Team"
          : "group_policies.groupHint.OrgUnit",
      )}
      actions={
        <div className="flex items-center gap-1">
          {canEdit && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setDialogError(undefined);
                setEditing(true);
              }}
              data-testid="group-policy-edit"
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              {t("buttons.edit")}
            </Button>
          )}
          {policy && canDelete && (
            <ConfirmDialog
              open={confirming}
              onOpenChange={setConfirming}
              title={t("group_policies.deleteTitle")}
              description={t("group_policies.deleteHint", { group: name })}
              okText={t("buttons.delete")}
              cancelText={t("buttons.cancel")}
              okButtonVariant="destructive"
              loading={writes.isPending}
              onConfirm={async () => {
                setActionError(undefined);
                try {
                  await writes.remove(policy);
                } catch (err) {
                  setActionError(errorText(err));
                }
                setConfirming(false);
              }}
            >
              <Button
                size="sm"
                variant="ghost"
                aria-label={t("buttons.delete")}
                title={t("buttons.delete")}
                data-testid="group-policy-delete"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </ConfirmDialog>
          )}
        </div>
      }
      data-testid="group-model-access"
    >
      {isLoading ? (
        <Loader className="h-4 text-primary" />
      ) : error ? (
        <p className="text-sm text-destructive">{errorText(error)}</p>
      ) : !hasRules(policy?.spec) ? (
        <p
          className="text-sm text-muted-foreground"
          data-testid="group-policy-unrestricted"
        >
          {t("group_policies.unrestricted")}
        </p>
      ) : (
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="mb-1 text-xs font-medium text-muted-foreground">
              {t("group_policies.fields.allowed")}
            </dt>
            <dd>
              <ModelEntryList
                entries={allowed}
                emptyText={t("group_policies.noRule")}
                data-testid="group-policy-allowed"
              />
            </dd>
          </div>
          <div>
            <dt className="mb-1 text-xs font-medium text-muted-foreground">
              {t("group_policies.fields.denied")}
            </dt>
            <dd>
              <ModelEntryList
                entries={denied}
                emptyText={t("group_policies.noRule")}
                data-testid="group-policy-denied"
              />
            </dd>
          </div>
          <div>
            <dt className="mb-1 text-xs font-medium text-muted-foreground">
              {t("group_policies.pool.title")}
            </dt>
            <dd>
              {tokenQuota ? (
                <TokenPoolSummary quota={tokenQuota} pool={pool.pool} />
              ) : (
                <span className="text-muted-foreground">
                  {t("group_policies.noRule")}
                </span>
              )}
            </dd>
          </div>
        </dl>
      )}
      {actionError && (
        <Alert variant="destructive" className="mt-3">
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}
      {editing && (
        <GroupPolicyDialog
          policy={policy}
          groupLabel={label ?? name}
          saving={writes.isPending}
          error={dialogError}
          onOpenChange={(open) => !open && setEditing(false)}
          onSave={async (nextAllowed, nextDenied, nextQuota) => {
            setDialogError(undefined);
            if (
              !policy &&
              nextAllowed.length + nextDenied.length === 0 &&
              !nextQuota
            ) {
              setEditing(false);
              return;
            }
            try {
              await writes.save(
                policy,
                buildGroupPolicySpec(
                  kind,
                  name,
                  nextAllowed,
                  nextDenied,
                  nextQuota,
                ),
              );
              setEditing(false);
            } catch (err) {
              setDialogError(errorText(err));
            }
          }}
        />
      )}
    </ShowPage.Section>
  );
}
