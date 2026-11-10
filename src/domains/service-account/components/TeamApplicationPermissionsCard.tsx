import { useList } from "@refinedev/core";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  useTeamApplicationPermissions,
  useTeamApplicationPermissionsWrites,
} from "@/domains/service-account/hooks/use-service-accounts";
import { isManagementRole } from "@/domains/service-account/lib/application-permissions";
import { serviceAccountErrorMessage } from "@/domains/service-account/lib/errors";
import type { TeamApplicationPermissions } from "@/domains/service-account/types";
import { ShowPage } from "@/foundation/components/ShowPage";
import { useTranslation } from "@/foundation/lib/i18n";
import type { Metadata } from "@/foundation/types/basic-types";

/**
 * The roles every application of a Team holds, and the workspaces they hold
 * them in. Everyone who reads the applications sees it; `canEdit` (a global
 * policy administrator) changes it.
 */
export function TeamApplicationPermissionsCard({
  teamId,
  canEdit,
}: {
  teamId: number;
  canEdit: boolean;
}) {
  const { t } = useTranslation();
  const { appPermissions, isLoading, error, refetch } =
    useTeamApplicationPermissions(teamId);
  const [editing, setEditing] = useState(false);

  return (
    <ShowPage.Section
      title={t("service_accounts.appPermissions.title")}
      description={t("service_accounts.appPermissions.hint")}
      data-testid="team-application-permissions"
      actions={
        canEdit && appPermissions ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setEditing(true)}
            data-testid="team-application-permissions-edit"
          >
            <Pencil className="mr-1 h-4 w-4" />
            {t("buttons.edit")}
          </Button>
        ) : undefined
      }
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">
          {t("service_accounts.messages.loading")}
        </p>
      ) : error || !appPermissions ? (
        <p className="text-sm text-muted-foreground">
          {t("service_accounts.appPermissions.unreadable")}
        </p>
      ) : (
        <AppPermissionsSummary appPermissions={appPermissions} />
      )}
      {editing && appPermissions && (
        <AppPermissionsDialog
          teamId={teamId}
          appPermissions={appPermissions}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            void refetch();
          }}
        />
      )}
    </ShowPage.Section>
  );
}

function AppPermissionsSummary({
  appPermissions,
}: {
  appPermissions: TeamApplicationPermissions;
}) {
  const { t } = useTranslation();
  return (
    <dl className="grid gap-2 text-sm sm:grid-cols-[8rem_1fr]">
      <dt className="text-muted-foreground">
        {t("service_accounts.appPermissions.roles")}
      </dt>
      <dd className="flex flex-wrap gap-1" data-testid="app-permissions-roles">
        {appPermissions.roles.length ? (
          appPermissions.roles.map((role) => (
            <Badge key={role} variant="outline">
              {role}
            </Badge>
          ))
        ) : (
          <span className="text-muted-foreground">
            {t("service_accounts.appPermissions.noRoles")}
          </span>
        )}
      </dd>
      <dt className="text-muted-foreground">
        {t("service_accounts.appPermissions.workspaces")}
      </dt>
      <dd
        className="flex flex-wrap gap-1"
        data-testid="app-permissions-workspaces"
      >
        {appPermissions.workspaces === null ? (
          <span>{t("service_accounts.appPermissions.allWorkspaces")}</span>
        ) : appPermissions.workspaces.length ? (
          appPermissions.workspaces.map((workspace) => (
            <Badge key={workspace} variant="outline">
              {workspace}
            </Badge>
          ))
        ) : (
          <span className="text-muted-foreground">
            {t("service_accounts.appPermissions.noWorkspaces")}
          </span>
        )}
      </dd>
      {appPermissions.is_default && (
        <dd className="text-xs text-muted-foreground sm:col-start-2">
          {t("service_accounts.appPermissions.isDefault")}
        </dd>
      )}
    </dl>
  );
}

const toggle = (list: string[], value: string, on: boolean) =>
  on ? [...new Set([...list, value])] : list.filter((item) => item !== value);

function AppPermissionsDialog({
  teamId,
  appPermissions,
  onClose,
  onSaved,
}: {
  teamId: number;
  appPermissions: TeamApplicationPermissions;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const writes = useTeamApplicationPermissionsWrites(teamId);
  const [roles, setRoles] = useState(appPermissions.roles);
  const [allWorkspaces, setAllWorkspaces] = useState(
    appPermissions.workspaces === null,
  );
  const [workspaces, setWorkspaces] = useState(appPermissions.workspaces ?? []);
  const [error, setError] = useState<string>();

  const roleList = useList<{
    metadata: Metadata;
    spec?: { permissions?: string[] };
  }>({
    resource: "roles",
    pagination: { mode: "off" },
  });
  const workspaceList = useList<{ metadata: Metadata }>({
    resource: "workspaces",
    pagination: { mode: "off" },
  });
  const roleNames = [
    ...new Set([
      ...(roleList.data?.data ?? [])
        .filter((role) => !isManagementRole(role.spec?.permissions))
        .map((role) => role.metadata.name),
      ...appPermissions.roles,
    ]),
  ].sort();
  const workspaceNames = [
    ...new Set([
      ...(workspaceList.data?.data ?? [])
        .filter((workspace) => !workspace.metadata.deletion_timestamp)
        .map((workspace) => workspace.metadata.name),
      ...(appPermissions.workspaces ?? []),
    ]),
  ].sort();

  const attempt = async (action: () => Promise<unknown>) => {
    setError(undefined);
    try {
      await action();
      onSaved();
    } catch (cause) {
      setError(
        serviceAccountErrorMessage(
          t,
          cause,
          t("service_accounts.messages.operationFailed"),
        ),
      );
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t("service_accounts.appPermissions.editTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("service_accounts.appPermissions.editHint")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">
              {t("service_accounts.appPermissions.roles")}
            </legend>
            {roleNames.map((role) => (
              <Label key={role} className="flex items-center gap-2 font-normal">
                <Checkbox
                  checked={roles.includes(role)}
                  onCheckedChange={(on) =>
                    setRoles((list) => toggle(list, role, on === true))
                  }
                  data-testid={`app-permissions-role-${role}`}
                />
                {role}
              </Label>
            ))}
            <p className="text-xs text-muted-foreground">
              {t("service_accounts.appPermissions.managementHidden")}
            </p>
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">
              {t("service_accounts.appPermissions.workspaces")}
            </legend>
            <Label className="flex items-center gap-2 font-normal">
              <Checkbox
                checked={allWorkspaces}
                onCheckedChange={(on) => setAllWorkspaces(on === true)}
                data-testid="app-permissions-all-workspaces"
              />
              {t("service_accounts.appPermissions.allWorkspaces")}
            </Label>
            {!allWorkspaces &&
              workspaceNames.map((workspace) => (
                <Label
                  key={workspace}
                  className="flex items-center gap-2 pl-6 font-normal"
                >
                  <Checkbox
                    checked={workspaces.includes(workspace)}
                    onCheckedChange={(on) =>
                      setWorkspaces((list) =>
                        toggle(list, workspace, on === true),
                      )
                    }
                  />
                  {workspace}
                </Label>
              ))}
          </fieldset>
          <p className="text-xs text-muted-foreground">
            {t("service_accounts.appPermissions.effectHint")}
          </p>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="ghost"
            disabled={appPermissions.is_default || writes.isPending}
            onClick={() => attempt(writes.reset)}
          >
            {t("service_accounts.appPermissions.reset")}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              {t("buttons.cancel")}
            </Button>
            <Button
              disabled={writes.isPending}
              onClick={() =>
                attempt(() =>
                  writes.save(appPermissions, {
                    roles,
                    workspaces: allWorkspaces ? null : workspaces,
                  }),
                )
              }
              data-testid="team-application-permissions-save"
            >
              {writes.isPending && <LoadingIcon className="mr-1 h-4 w-4" />}
              {t("buttons.save")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
