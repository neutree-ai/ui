import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AssignOrgUnitDialog } from "@/domains/organization/components/AssignOrgUnitDialog";
import { InactiveBadge } from "@/domains/organization/components/InactiveBadge";
import {
  MembershipOutOfScopeError,
  useAssignOrgUnit,
  useOrgTree,
  useUserOrgUnit,
  useUserTeams,
} from "@/domains/organization/hooks/use-organization";
import { isInactive } from "@/domains/organization/lib/org-tree";
import { ORGANIZATION_ERROR_KEYS } from "@/domains/organization/lib/organization-errors";
import { teamSource } from "@/domains/organization/lib/team";
import { orgUnitAssignmentMode } from "@/domains/organization/lib/user-org-unit";
import type { MemberProfile } from "@/domains/organization/types";
import { ConfirmDialog } from "@/foundation/components/ConfirmDialog";
import { EmptyState } from "@/foundation/components/EmptyState";
import { Loader } from "@/foundation/components/Loader";
import { ShowPage } from "@/foundation/components/ShowPage";
import Timestamp from "@/foundation/components/Timestamp";
import {
  useHasGlobalPermission,
  useHasPermission,
} from "@/foundation/hooks/use-has-permission";
import {
  isPermissionDenied,
  translateApiErrorOr,
} from "@/foundation/lib/api-error-code";
import { displayName } from "@/foundation/lib/display-name";
import { useTranslation } from "@/foundation/lib/i18n";
import { cn } from "@/foundation/lib/utils";

/**
 * `deniedKey` translates an RLS refusal (42501). The department writes here
 * are the only ones scoped by subtree, so it means a department outside the
 * caller's.
 */
const useErrorText = () => {
  const { t } = useTranslation();
  return (error: unknown, deniedKey?: string) => {
    if (!error) return undefined;
    if (error instanceof MembershipOutOfScopeError) {
      return t("user_profiles.department.errors.currentOutsideScope");
    }
    if (deniedKey && isPermissionDenied(error)) return t(deniedKey);
    return translateApiErrorOr(
      t,
      error,
      ORGANIZATION_ERROR_KEYS,
      "common.errors.unknown",
    );
  };
};

const Loading = () => (
  <div className="flex justify-center py-4">
    <Loader className="w-10 text-muted-foreground" />
  </div>
);

/**
 * The user's primary department. Hidden without org_unit:read, which also
 * hides the membership rows. Local users can be assigned one by hand.
 * Assigning a user with no department needs a global org_unit:assign-member
 * (D76): the user is in no subtree yet, so a subtree grant cannot cover it.
 */
export function UserDepartmentSection({ profile }: { profile: MemberProfile }) {
  const { t } = useTranslation();
  const errorText = useErrorText();
  const { allowed: canRead } = useHasPermission("org_unit:read");
  const { allowed: canEdit } = useHasPermission("org_unit:assign-member");
  const { allowed: canAssignNew } = useHasGlobalPermission(
    "org_unit:assign-member",
  );
  const { membership, isLoading, error } = useUserOrgUnit(
    profile.id,
    canRead === true,
  );
  const mode = orgUnitAssignmentMode(profile, membership);
  const editable =
    mode === "update"
      ? canEdit === true
      : mode === "create" && canAssignNew === true;
  // The tree is needed for the path and, when editable, for the picker.
  const units = useOrgTree(canRead === true);

  const assign = useAssignOrgUnit(profile.id);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const [removeError, setRemoveError] = useState<string>();

  if (canRead !== true) return null;

  const unit = membership?.org_units;
  const onSave = async (orgUnitId: number) => {
    setSaveError(undefined);
    try {
      if (mode === "update") await assign.update(orgUnitId);
      else await assign.create(orgUnitId);
      setDialogOpen(false);
    } catch (cause) {
      setSaveError(
        errorText(
          cause,
          mode === "update"
            ? "user_profiles.department.errors.targetOutsideScope"
            : undefined,
        ),
      );
    }
  };
  const onRemove = async () => {
    setRemoveError(undefined);
    try {
      await assign.remove();
    } catch (cause) {
      setRemoveError(
        errorText(cause, "user_profiles.department.errors.currentOutsideScope"),
      );
    }
    setConfirmRemove(false);
  };

  return (
    <ShowPage.Section
      title={t("user_profiles.sections.department")}
      data-testid="user-department-card"
      actions={
        editable && (
          <div className="flex items-center gap-2">
            {mode === "update" && (
              <ConfirmDialog
                open={confirmRemove}
                onOpenChange={setConfirmRemove}
                title={t("user_profiles.department.removeTitle")}
                description={t("user_profiles.department.removeHint")}
                okText={t("buttons.delete")}
                cancelText={t("buttons.cancel")}
                okButtonVariant="destructive"
                loading={assign.isPending}
                onConfirm={onRemove}
              >
                <Button
                  variant="outline"
                  size="sm"
                  data-testid="user-department-remove"
                >
                  {t("user_profiles.department.remove")}
                </Button>
              </ConfirmDialog>
            )}
            <Button
              size="sm"
              onClick={() => {
                setSaveError(undefined);
                setDialogOpen(true);
              }}
              data-testid="user-department-assign"
            >
              {mode === "update"
                ? t("user_profiles.department.change")
                : t("user_profiles.department.assign")}
            </Button>
          </div>
        )
      }
    >
      {isLoading || units.isLoading ? (
        <Loading />
      ) : error ? (
        <EmptyState variant="inline" className="text-destructive">
          {errorText(error)}
        </EmptyState>
      ) : unit ? (
        <dl
          className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm"
          data-testid="user-department"
        >
          <dt className="text-muted-foreground">
            {t("organization.fields.department")}
          </dt>
          <dd
            className={cn(
              "flex items-center gap-2",
              isInactive(unit) && "text-muted-foreground",
            )}
          >
            <span data-testid="user-department-path">
              {units.byId.get(unit.id)?.pathLabel ?? displayName(unit.metadata)}
            </span>
            {isInactive(unit) && <InactiveBadge />}
          </dd>
          <dt className="text-muted-foreground">
            {t("organization.fields.source")}
          </dt>
          <dd data-testid="user-department-source">
            {membership.identity_source ?? t("organization.values.manual")}
          </dd>
          <dt className="text-muted-foreground">
            {t("organization.fields.assignedAt")}
          </dt>
          <dd>
            <Timestamp timestamp={membership.assigned_at} relative />
          </dd>
        </dl>
      ) : (
        <EmptyState variant="inline" data-testid="user-department-empty">
          {t("user_profiles.department.none")}
        </EmptyState>
      )}
      {removeError && (
        <p
          className="mt-2 text-sm text-destructive"
          data-testid="user-department-remove-error"
        >
          {removeError}
        </p>
      )}
      {dialogOpen && (
        <AssignOrgUnitDialog
          open
          onOpenChange={setDialogOpen}
          tree={units.roots}
          currentId={membership?.org_unit_id}
          saving={assign.isPending}
          error={saveError}
          onSave={onSave}
        />
      )}
    </ShowPage.Section>
  );
}

/**
 * The teams a user is in. Hidden without a global team:read, the only grant
 * the teams RLS accepts (D69).
 */
export function UserTeamsSection({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const errorText = useErrorText();
  const { allowed: canRead } = useHasGlobalPermission("team:read");
  const { members, isLoading, error } = useUserTeams(userId, canRead === true);

  if (canRead !== true) return null;

  const teams = members
    .map((m) => m.teams)
    .filter((team) => !!team)
    .sort((a, b) =>
      displayName(a.metadata).localeCompare(displayName(b.metadata)),
    );

  return (
    <ShowPage.Section
      title={t("user_profiles.sections.teams")}
      data-testid="user-teams-card"
    >
      {isLoading ? (
        <Loading />
      ) : error ? (
        <EmptyState variant="inline" className="text-destructive">
          {errorText(error)}
        </EmptyState>
      ) : teams.length ? (
        <ul className="flex flex-wrap gap-2" data-testid="user-teams">
          {teams.map((team) => (
            <li key={team.id}>
              <Badge
                variant="outline"
                className={cn(
                  "gap-1.5 font-normal",
                  isInactive(team) && "text-muted-foreground",
                )}
              >
                {displayName(team.metadata)}
                <span
                  className="text-xs text-muted-foreground"
                  data-testid={`user-team-source-${team.id}`}
                >
                  {teamSource(team) || t("organization.values.manualTeam")}
                </span>
                {isInactive(team) && <InactiveBadge />}
              </Badge>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState variant="inline" data-testid="user-teams-empty">
          {t("user_profiles.teams.none")}
        </EmptyState>
      )}
    </ShowPage.Section>
  );
}
