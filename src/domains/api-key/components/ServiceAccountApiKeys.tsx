import {
  useDelete,
  useInvalidate,
  useList,
  useNavigation,
} from "@refinedev/core";
import { Pencil, Plus, Power, PowerOff, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CreateApiKeyForm } from "@/domains/api-key/components/CreateApiKeyForm";
import {
  rateSummary,
  useApiKeyDisable,
} from "@/domains/api-key/hooks/use-api-key-policy";
import { serviceAccountKeyErrorMessage } from "@/domains/api-key/lib/create-api-key-error";
import type { ApiKey } from "@/domains/api-key/types";
import { DeleteConfirmDialog } from "@/foundation/components/DeleteConfirmDialog";
import { EmptyState } from "@/foundation/components/EmptyState";
import { EMPTY_VALUE, EmptyValue } from "@/foundation/components/EmptyValue";
import { Loader } from "@/foundation/components/Loader";
import { ShowPage } from "@/foundation/components/ShowPage";
import Timestamp from "@/foundation/components/Timestamp";
import { buildBatchDeleteVariables } from "@/foundation/lib/batch-delete";
import { displayName } from "@/foundation/lib/display-name";
import { formatTokenQuota } from "@/foundation/lib/token-quota";

type ServiceAccountApiKeysProps = {
  serviceAccountId: string;
  serviceAccountName: string;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
};

/**
 * The API keys of an application. They call models with the Team's
 * application permissions, model access and token pool, and keep working
 * when their creator leaves the Team.
 */
export function ServiceAccountApiKeys({
  serviceAccountId,
  serviceAccountName,
  canCreate,
  canUpdate,
  canDelete,
}: ServiceAccountApiKeysProps) {
  const { t } = useTranslation();
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<ApiKey>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const { show } = useNavigation();
  const invalidate = useInvalidate();
  const { mutateAsync: deleteKey } = useDelete();
  const { disable, enable } = useApiKeyDisable();

  const query = useList<ApiKey>({
    resource: "api_keys",
    pagination: { mode: "off" },
    filters: [
      { field: "service_account_id", operator: "eq", value: serviceAccountId },
    ],
  });
  const keys = (query.data?.data ?? [])
    .filter((key) => !key.metadata?.deletion_timestamp)
    .sort((a, b) =>
      String(b.metadata.creation_timestamp ?? "").localeCompare(
        String(a.metadata.creation_timestamp ?? ""),
      ),
    );

  const refresh = () =>
    invalidate({ resource: "api_keys", invalidates: ["list"] });

  const run = async (action: () => Promise<unknown>) => {
    setError(undefined);
    setPending(true);
    try {
      await action();
      await refresh();
    } catch (cause) {
      setError(
        serviceAccountKeyErrorMessage(
          t,
          cause,
          t("api_keys.messages.operationFailed"),
        ),
      );
    } finally {
      setPending(false);
    }
  };

  const remove = (key: ApiKey) =>
    run(async () => {
      const [variable] = buildBatchDeleteVariables(
        [
          {
            original: {
              metadata: {
                ...key.metadata,
                workspace: key.metadata.workspace ?? undefined,
              },
            },
          },
        ],
        "api_keys",
        false,
      );
      if (!variable) throw new Error(t("api_keys.messages.missingName"));
      await deleteKey(variable);
      setDeleting(undefined);
    });

  const modelSummary = (key: ApiKey) => {
    const models = key.spec.limits?.allowed_models ?? [];
    return models.length
      ? t("api_keys.serviceAccount.modelCount", { count: models.length })
      : t("api_keys.serviceAccount.allTeamModels");
  };

  const quotaSummary = (key: ApiKey) => {
    const quota = key.spec.limits?.token_quota;
    const parts = rateSummary(key.spec.limits);
    if (quota?.limit) {
      parts.unshift(
        `${formatTokenQuota(quota.limit)} / ${t(
          `api_keys.limits.periods.${quota.period ?? "monthly"}`,
        )}`,
      );
    }
    return parts.length ? parts.join(" · ") : EMPTY_VALUE;
  };

  return (
    <ShowPage.Section
      title={t("api_keys.serviceAccount.title")}
      hint={t("api_keys.serviceAccount.hint", { name: serviceAccountName })}
      actions={
        canCreate && (
          <Button
            size="sm"
            onClick={() => setCreating(true)}
            data-testid="sa-api-key-create"
          >
            <Plus className="mr-1 h-4 w-4" />
            {t("api_keys.create")}
          </Button>
        )
      }
      data-testid="sa-api-keys"
      contentClassName="space-y-3"
    >
      {query.isLoading ? (
        <div className="flex justify-center py-6">
          <Loader className="w-10 text-muted-foreground" />
        </div>
      ) : query.error ? (
        <EmptyState variant="inline" className="text-destructive">
          {serviceAccountKeyErrorMessage(
            t,
            query.error,
            t("api_keys.messages.operationFailed"),
          )}
        </EmptyState>
      ) : !keys.length ? (
        <EmptyState variant="inline" data-testid="sa-api-keys-empty">
          {t("api_keys.serviceAccount.empty")}
        </EmptyState>
      ) : (
        <Table data-testid="sa-api-key-table">
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.fields.name")}</TableHead>
              <TableHead>{t("api_keys.fields.workspace")}</TableHead>
              <TableHead>{t("api_keys.fields.status")}</TableHead>
              <TableHead>{t("api_keys.serviceAccount.models")}</TableHead>
              <TableHead>{t("api_keys.serviceAccount.limits")}</TableHead>
              <TableHead>{t("api_keys.fields.createdAt")}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {keys.map((key) => {
              const disabled = !!key.spec.limits?.disabled;
              return (
                <TableRow key={key.id} data-testid={`sa-api-key-${key.id}`}>
                  <TableCell>
                    <div className="font-medium">
                      {displayName(key.metadata)}
                    </div>
                    {key.spec.description && (
                      <div className="text-xs text-muted-foreground">
                        {key.spec.description}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {key.metadata.workspace ?? <EmptyValue />}
                  </TableCell>
                  <TableCell>
                    <Badge variant={disabled ? "destructive" : "outline"}>
                      {disabled
                        ? t("api_keys.limits.statusDisabled")
                        : t("api_keys.limits.statusActive")}
                    </Badge>
                  </TableCell>
                  <TableCell>{modelSummary(key)}</TableCell>
                  <TableCell className="text-xs">{quotaSummary(key)}</TableCell>
                  <TableCell>
                    <Timestamp
                      timestamp={key.metadata.creation_timestamp}
                      relative
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {canUpdate && (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            title={t("api_keys.serviceAccount.editLimits")}
                            aria-label={t("api_keys.serviceAccount.editLimits")}
                            onClick={() =>
                              show("api_keys", key.metadata.name, "push", {
                                workspace: key.metadata.workspace,
                              })
                            }
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            disabled={pending}
                            title={
                              disabled
                                ? t("api_keys.limits.enable")
                                : t("api_keys.limits.disable")
                            }
                            aria-label={
                              disabled
                                ? t("api_keys.limits.enable")
                                : t("api_keys.limits.disable")
                            }
                            data-testid={`sa-api-key-toggle-${key.id}`}
                            onClick={() =>
                              run(() =>
                                disabled ? enable(key.id) : disable(key.id),
                              )
                            }
                          >
                            {disabled ? (
                              <Power className="h-4 w-4" />
                            ) : (
                              <PowerOff className="h-4 w-4" />
                            )}
                          </Button>
                        </>
                      )}
                      {canDelete && (
                        <DeleteConfirmDialog
                          allowForceDelete={false}
                          open={deleting?.id === key.id}
                          onOpenChange={(next) =>
                            setDeleting(next ? key : undefined)
                          }
                          title={t("api_keys.serviceAccount.deleteTitle", {
                            name: displayName(key.metadata),
                          })}
                          description={t("api_keys.serviceAccount.deleteHint")}
                          loading={pending}
                          onConfirm={() => remove(key)}
                        >
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive"
                            title={t("buttons.delete")}
                            aria-label={t("buttons.delete")}
                            data-testid={`sa-api-key-delete-${key.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </DeleteConfirmDialog>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {error && (
        <Alert variant="destructive" data-testid="sa-api-key-error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {t("api_keys.serviceAccount.createTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("api_keys.serviceAccount.createHint", {
                name: serviceAccountName,
              })}
            </DialogDescription>
          </DialogHeader>
          {/* Mounted per opening, so each starts from an empty form. */}
          {creating && (
            <CreateApiKeyForm
              serviceAccountId={serviceAccountId}
              onClose={() => setCreating(false)}
              onCreated={refresh}
            />
          )}
        </DialogContent>
      </Dialog>
    </ShowPage.Section>
  );
}
