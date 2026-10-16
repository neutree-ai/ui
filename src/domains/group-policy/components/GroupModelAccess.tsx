import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { GroupPolicyDialog } from "@/domains/group-policy/components/GroupPolicyDialog";
import { ModelEntryList } from "@/domains/group-policy/components/ModelEntryList";
import {
  GroupPolicyGoneError,
  useGroupPolicy,
  useGroupPolicyWrites,
} from "@/domains/group-policy/hooks/use-group-policies";
import { groupPolicyErrorMessage } from "@/domains/group-policy/lib/group-policy-errors";
import {
  buildGroupPolicySpec,
  hasRules,
} from "@/domains/group-policy/lib/model-entries";
import type { GroupPolicySubjectKind } from "@/domains/group-policy/types";
import { ConfirmDialog } from "@/foundation/components/ConfirmDialog";
import { Loader } from "@/foundation/components/Loader";
import { ShowPage } from "@/foundation/components/ShowPage";
import { useHasGlobalPermission } from "@/foundation/hooks/use-has-permission";
import { getErrorMessage } from "@/foundation/lib/error-message";
import { useTranslation } from "@/foundation/lib/i18n";

/**
 * The model access policy of a Team or a department. Policies are Neutree
 * data, so synced groups take one too. Global group_policy:* only.
 */
export function GroupModelAccess({
  kind,
  name,
}: {
  kind: GroupPolicySubjectKind;
  name: string;
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
          groupLabel={name}
          saving={writes.isPending}
          error={dialogError}
          onOpenChange={(open) => !open && setEditing(false)}
          onSave={async (nextAllowed, nextDenied) => {
            setDialogError(undefined);
            if (!policy && nextAllowed.length + nextDenied.length === 0) {
              setEditing(false);
              return;
            }
            try {
              await writes.save(
                policy,
                buildGroupPolicySpec(kind, name, nextAllowed, nextDenied),
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
