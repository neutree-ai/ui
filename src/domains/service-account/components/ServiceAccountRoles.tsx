import { Plus, Trash2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  type ServiceAccountRoleAssignment,
  useServiceAccountCeiling,
  useServiceAccountRoleAssignments,
  useServiceAccountRoleWrites,
} from "@/domains/service-account/hooks/use-service-accounts";
import { serviceAccountErrorMessage } from "@/domains/service-account/lib/errors";
import type {
  ServiceAccount,
  ServiceAccountCeiling,
} from "@/domains/service-account/types";
import { ConfirmDialog } from "@/foundation/components/ConfirmDialog";
import { EmptyState } from "@/foundation/components/EmptyState";
import { ShowPage } from "@/foundation/components/ShowPage";
import {
  ALL_WORKSPACES,
  useWorkspace,
  useWorkspaceOptions,
} from "@/foundation/hooks/use-workspace";
import { useTranslation } from "@/foundation/lib/i18n";

const GLOBAL = "__global__";

/**
 * The roles an application holds. `canAssign` grants and revokes them, within
 * the Team's ceiling: the server refuses anything outside it (10323).
 */
export function ServiceAccountRoles({
  account,
  canAssign,
}: {
  account: ServiceAccount;
  canAssign: boolean;
}) {
  const { t } = useTranslation();
  const { rows, isLoading, error } = useServiceAccountRoleAssignments(
    account.id,
  );
  const { ceiling } = useServiceAccountCeiling(account.team_id);
  const writes = useServiceAccountRoleWrites();
  const [granting, setGranting] = useState(false);
  const [revoking, setRevoking] = useState<ServiceAccountRoleAssignment>();
  const [actionError, setActionError] = useState<string>();

  const revoke = async (row: ServiceAccountRoleAssignment) => {
    setActionError(undefined);
    try {
      await writes.revoke(row);
      setRevoking(undefined);
    } catch (cause) {
      setActionError(
        serviceAccountErrorMessage(
          t,
          cause,
          t("service_accounts.messages.operationFailed"),
        ),
      );
    }
  };

  const outsideCeiling = (row: ServiceAccountRoleAssignment) =>
    !!ceiling &&
    (!ceiling.roles.includes(row.spec.role) ||
      (ceiling.workspaces !== null &&
        (row.spec.global ||
          !ceiling.workspaces.includes(row.spec.workspace ?? ""))));

  return (
    <ShowPage.Section
      title={t("service_accounts.roles.title")}
      description={t("service_accounts.roles.hint")}
      data-testid="service-account-roles"
      actions={
        canAssign ? (
          <Button
            size="sm"
            onClick={() => setGranting(true)}
            disabled={!ceiling || ceiling.roles.length === 0}
            data-testid="service-account-grant"
          >
            <Plus className="mr-1 h-4 w-4" />
            {t("service_accounts.roles.grant")}
          </Button>
        ) : undefined
      }
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">
          {t("service_accounts.messages.loading")}
        </p>
      ) : error ? (
        <EmptyState variant="inline" className="text-destructive">
          {serviceAccountErrorMessage(
            t,
            error,
            t("service_accounts.messages.operationFailed"),
          )}
        </EmptyState>
      ) : !rows.length ? (
        <EmptyState variant="inline" data-testid="service-account-roles-empty">
          {t("service_accounts.roles.empty")}
        </EmptyState>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.fields.role")}</TableHead>
              <TableHead>{t("service_accounts.roles.scope")}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.id}
                data-testid={`service-account-role-${row.id}`}
              >
                <TableCell>
                  <span className="font-medium">{row.spec.role}</span>
                  {outsideCeiling(row) && (
                    <span className="ml-2 text-xs text-destructive">
                      {t("service_accounts.roles.outsideCeiling")}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {row.spec.global
                    ? t("service_accounts.roles.global")
                    : t("service_accounts.roles.inWorkspace", {
                        workspace: row.spec.workspace,
                      })}
                </TableCell>
                <TableCell className="text-right">
                  {canAssign && (
                    <ConfirmDialog
                      open={revoking?.id === row.id}
                      onOpenChange={(next) =>
                        setRevoking(next ? row : undefined)
                      }
                      title={t("service_accounts.roles.revokeTitle", {
                        role: row.spec.role,
                      })}
                      description={t("service_accounts.roles.revokeHint")}
                      okText={t("service_accounts.roles.revoke")}
                      cancelText={t("buttons.cancel")}
                      okButtonVariant="destructive"
                      loading={writes.isPending}
                      onConfirm={() => revoke(row)}
                    >
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        title={t("service_accounts.roles.revoke")}
                        aria-label={t("service_accounts.roles.revoke")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </ConfirmDialog>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {actionError && (
        <Alert variant="destructive" className="mt-3">
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}
      {granting && ceiling && (
        <GrantDialog
          account={account}
          ceiling={ceiling}
          onClose={() => setGranting(false)}
        />
      )}
    </ShowPage.Section>
  );
}

function GrantDialog({
  account,
  ceiling,
  onClose,
}: {
  account: ServiceAccount;
  ceiling: ServiceAccountCeiling;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const writes = useServiceAccountRoleWrites();
  const { workspaces } = useWorkspaceOptions();
  const { current } = useWorkspace();
  const [role, setRole] = useState(ceiling.roles[0] ?? "");
  // A Team admin may not list workspaces; the current one, or default, stands in.
  const listed = workspaces.map((workspace) => workspace.metadata.name);
  const fallback = current && current !== ALL_WORKSPACES ? current : "default";
  const scopeOptions =
    ceiling.workspaces === null
      ? [GLOBAL, ...(listed.length ? listed : [fallback])]
      : ceiling.workspaces;
  const [scope, setScope] = useState(scopeOptions[0] ?? GLOBAL);
  const [error, setError] = useState<string>();

  const submit = async () => {
    setError(undefined);
    try {
      await writes.grant(account, role, scope === GLOBAL ? null : scope);
      onClose();
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("service_accounts.roles.grantTitle")}</DialogTitle>
          <DialogDescription>
            {t("service_accounts.roles.grantHint")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("common.fields.role")}</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger data-testid="service-account-grant-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ceiling.roles.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("service_accounts.roles.scope")}</Label>
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger data-testid="service-account-grant-scope">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {scopeOptions.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value === GLOBAL
                      ? t("service_accounts.roles.global")
                      : t("service_accounts.roles.inWorkspace", {
                          workspace: value,
                        })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && (
            <Alert
              variant="destructive"
              data-testid="service-account-grant-error"
            >
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("buttons.cancel")}
          </Button>
          <Button
            disabled={!role || !scope || writes.isPending}
            onClick={submit}
            data-testid="service-account-grant-submit"
          >
            {writes.isPending && <LoadingIcon className="mr-1 h-4 w-4" />}
            {t("service_accounts.roles.grant")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
