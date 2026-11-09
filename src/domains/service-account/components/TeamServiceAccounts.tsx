import { ArrowLeft, Plus, Power, PowerOff, Trash2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ServiceAccountCeilingCard } from "@/domains/service-account/components/ServiceAccountCeilingCard";
import {
  useServiceAccounts,
  useServiceAccountWrites,
} from "@/domains/service-account/hooks/use-service-accounts";
import { serviceAccountErrorMessage } from "@/domains/service-account/lib/errors";
import type { ServiceAccount } from "@/domains/service-account/types";
import { DeleteConfirmDialog } from "@/foundation/components/DeleteConfirmDialog";
import { EmptyState } from "@/foundation/components/EmptyState";
import { Loader } from "@/foundation/components/Loader";
import { ShowPage } from "@/foundation/components/ShowPage";
import Timestamp from "@/foundation/components/Timestamp";
import { displayName } from "@/foundation/lib/display-name";
import { useTranslation } from "@/foundation/lib/i18n";
import { isValidResourceName } from "@/foundation/lib/validate";

type ServiceAccountPermissions = {
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  /** A global policy administrator: edits the Team's application permissions. */
  canEditCeiling: boolean;
};

/**
 * The applications of a Team, and one application's keys, permissions and usage.
 * Keys and usage belong to other domains: the page renders them.
 */
export function TeamServiceAccounts({
  teamId,
  teamName,
  permissions,
  renderKeys,
  renderUsage,
}: {
  teamId: number;
  teamName: string;
  permissions: ServiceAccountPermissions;
  renderKeys: (account: ServiceAccount) => ReactNode;
  renderUsage: (account: ServiceAccount) => ReactNode;
}) {
  const { t } = useTranslation();
  const { rows, isLoading, error } = useServiceAccounts(teamId);
  const writes = useServiceAccountWrites();
  const [selectedId, setSelectedId] = useState<string>();
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<ServiceAccount>();
  const [actionError, setActionError] = useState<string>();
  const selected = rows.find((row) => row.id === selectedId);

  const attempt = async (action: () => Promise<unknown>) => {
    setActionError(undefined);
    try {
      await action();
      return true;
    } catch (cause) {
      setActionError(
        serviceAccountErrorMessage(
          t,
          cause,
          t("service_accounts.messages.operationFailed"),
        ),
      );
      return false;
    }
  };

  const actions = (account: ServiceAccount) => {
    const disabled = !!account.spec?.disabled;
    return (
      <div className="flex justify-end gap-1">
        {permissions.canUpdate && (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            disabled={writes.isPending}
            title={
              disabled
                ? t("service_accounts.actions.enable")
                : t("service_accounts.actions.disable")
            }
            aria-label={
              disabled
                ? t("service_accounts.actions.enable")
                : t("service_accounts.actions.disable")
            }
            data-testid={`service-account-toggle-${account.metadata.name}`}
            onClick={(event) => {
              event.stopPropagation();
              void attempt(() => writes.setDisabled(account, !disabled));
            }}
          >
            {disabled ? (
              <Power className="h-4 w-4" />
            ) : (
              <PowerOff className="h-4 w-4" />
            )}
          </Button>
        )}
        {permissions.canDelete && (
          <DeleteConfirmDialog
            allowForceDelete={false}
            open={deleting?.id === account.id}
            onOpenChange={(next) => setDeleting(next ? account : undefined)}
            title={t("service_accounts.deleteTitle", {
              name: displayName(account.metadata),
            })}
            description={t("service_accounts.deleteHint")}
            loading={writes.isPending}
            onConfirm={async () => {
              const removed = await attempt(() => writes.remove(account));
              setDeleting(undefined);
              if (removed && selectedId === account.id) {
                setSelectedId(undefined);
              }
            }}
          >
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-destructive"
              title={t("buttons.delete")}
              aria-label={t("buttons.delete")}
              data-testid={`service-account-delete-${account.metadata.name}`}
              onClick={(event) => event.stopPropagation()}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </DeleteConfirmDialog>
        )}
      </div>
    );
  };

  const status = (account: ServiceAccount) =>
    account.spec?.disabled ? (
      <Badge variant="destructive">
        {t("service_accounts.status.disabled")}
      </Badge>
    ) : (
      <Badge variant="outline">{t("service_accounts.status.enabled")}</Badge>
    );

  const errorAlert = actionError && (
    <Alert variant="destructive" data-testid="service-account-error">
      <AlertDescription>{actionError}</AlertDescription>
    </Alert>
  );

  if (selected) {
    return (
      <div className="space-y-3" data-testid="service-account-detail">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedId(undefined)}
              data-testid="service-account-back"
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              {t("service_accounts.back")}
            </Button>
            <span className="truncate font-semibold">
              {displayName(selected.metadata)}
            </span>
            {status(selected)}
          </div>
          {actions(selected)}
        </div>
        {selected.spec?.description && (
          <p className="text-sm text-muted-foreground">
            {selected.spec.description}
          </p>
        )}
        {selected.spec?.disabled && (
          <Alert>
            <AlertDescription>
              {t("service_accounts.disabledHint")}
            </AlertDescription>
          </Alert>
        )}
        {errorAlert}
        {renderKeys(selected)}
        <ServiceAccountCeilingCard teamId={selected.team_id} canEdit={false} />
        {renderUsage(selected)}
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="team-service-accounts">
      <ServiceAccountCeilingCard
        teamId={teamId}
        canEdit={permissions.canEditCeiling}
      />
      <ShowPage.Section
        title={t("service_accounts.title")}
        description={t("service_accounts.hint", { team: teamName })}
        actions={
          permissions.canCreate ? (
            <Button
              size="sm"
              onClick={() => setCreating(true)}
              data-testid="service-account-create"
            >
              <Plus className="mr-1 h-4 w-4" />
              {t("service_accounts.create")}
            </Button>
          ) : undefined
        }
      >
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader className="w-10 text-muted-foreground" />
          </div>
        ) : error ? (
          <EmptyState variant="inline" className="text-destructive">
            {serviceAccountErrorMessage(
              t,
              error,
              t("service_accounts.messages.operationFailed"),
            )}
          </EmptyState>
        ) : !rows.length ? (
          <EmptyState variant="inline" data-testid="service-accounts-empty">
            {t("service_accounts.empty")}
          </EmptyState>
        ) : (
          <Table data-testid="service-account-table">
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.fields.name")}</TableHead>
                <TableHead>{t("common.fields.status")}</TableHead>
                <TableHead>{t("common.fields.createdAt")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((account) => (
                <TableRow
                  key={account.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedId(account.id)}
                  data-testid={`service-account-${account.metadata.name}`}
                >
                  <TableCell>
                    <div className="font-medium text-primary">
                      {displayName(account.metadata)}
                    </div>
                    {account.spec?.description && (
                      <div className="text-xs text-muted-foreground">
                        {account.spec.description}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{status(account)}</TableCell>
                  <TableCell>
                    <Timestamp
                      timestamp={account.metadata.creation_timestamp}
                      relative
                    />
                  </TableCell>
                  <TableCell>{actions(account)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {errorAlert && <div className="mt-3">{errorAlert}</div>}
      </ShowPage.Section>
      {creating && (
        <CreateServiceAccountDialog
          teamId={teamId}
          onClose={() => setCreating(false)}
          onCreated={(account) => {
            setCreating(false);
            if (account) setSelectedId(account.id);
          }}
        />
      )}
    </div>
  );
}

function CreateServiceAccountDialog({
  teamId,
  onClose,
  onCreated,
}: {
  teamId: number;
  onClose: () => void;
  onCreated: (account: ServiceAccount | undefined) => void;
}) {
  const { t } = useTranslation();
  const writes = useServiceAccountWrites();
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string>();
  const trimmed = name.trim();
  const nameError = !trimmed
    ? t("service_accounts.validation.nameRequired")
    : trimmed.length > 63 || !isValidResourceName(trimmed)
      ? t("service_accounts.validation.nameFormat")
      : undefined;

  const submit = async () => {
    setTouched(true);
    if (nameError) return;
    setError(undefined);
    try {
      const account = await writes.create(teamId, {
        name: trimmed,
        displayName: displayName.trim() || trimmed,
        description: description.trim(),
      });
      onCreated(account);
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
          <DialogTitle>{t("service_accounts.createTitle")}</DialogTitle>
          <DialogDescription>
            {t("service_accounts.createHint")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="sa-name">{t("common.fields.name")}</Label>
            <Input
              id="sa-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="my-app"
              data-testid="service-account-name"
            />
            {touched && nameError && (
              <p className="text-xs text-destructive">{nameError}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sa-display-name">
              {t("service_accounts.fields.displayName")}
            </Label>
            <Input
              id="sa-display-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sa-description">
              {t("common.fields.description")}
            </Label>
            <Textarea
              id="sa-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("buttons.cancel")}
          </Button>
          <Button
            disabled={writes.isPending}
            onClick={submit}
            data-testid="service-account-create-submit"
          >
            {writes.isPending && <LoadingIcon className="mr-1 h-4 w-4" />}
            {t("buttons.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
