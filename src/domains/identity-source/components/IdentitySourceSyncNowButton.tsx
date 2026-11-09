import { useCustomMutation, useInvalidate } from "@refinedev/core";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { identitySourceErrorMessage } from "@/domains/identity-source/lib/identity-source-errors";
import {
  isSyncEnabled,
  isSyncPaused,
  isSyncRequestPending,
} from "@/domains/identity-source/lib/identity-source-sync";
import type { IdentitySource } from "@/domains/identity-source/types";
import { useHasGlobalPermission } from "@/foundation/hooks/use-has-permission";
import { displayName } from "@/foundation/lib/display-name";
import { getErrorMessage } from "@/foundation/lib/error-message";
import { useTranslation } from "@/foundation/lib/i18n";

/**
 * Asks neutree-core to sync the source now. The request is an update of the
 * source (RLS checks identity_source:update, granted globally only), so the
 * button is offered to the same users who can edit it.
 */
export function IdentitySourceSyncNowButton({
  record,
}: {
  record: IdentitySource;
}) {
  const { t } = useTranslation();
  const { allowed } = useHasGlobalPermission("identity_source:update");
  const { mutate, isLoading } = useCustomMutation();
  const invalidate = useInvalidate();

  if (allowed !== true) return null;

  const name = displayName(record.metadata);
  const enabled = isSyncEnabled(record) && !record.metadata.deletion_timestamp;
  const pending = isSyncRequestPending(record);

  const button = (
    <Button
      variant="outline"
      size="sm"
      data-testid="identity-source-sync-now"
      disabled={!enabled || pending || isLoading}
      onClick={() =>
        mutate(
          {
            url: "/rpc/request_identity_source_sync",
            method: "post",
            values: { p_name: record.metadata.name },
            successNotification: () => ({
              type: "success",
              message: t("identity_sources.messages.syncRequested", { name }),
            }),
            errorNotification: (error) => ({
              type: "error",
              message: t("identity_sources.messages.syncRequestFailed", {
                name,
              }),
              description:
                identitySourceErrorMessage(t, error) ??
                getErrorMessage(error, t("pages.error.unknown")),
            }),
          },
          {
            onSuccess: () =>
              invalidate({
                resource: "identity_sources",
                invalidates: ["list", "detail"],
                id: record.metadata.name,
              }),
          },
        )
      }
    >
      <RefreshCw className={pending ? "animate-spin" : undefined} />
      {t(
        pending
          ? "identity_sources.actions.syncing"
          : "identity_sources.actions.syncNow",
      )}
    </Button>
  );

  if (enabled) return button;

  // A disabled button gets no pointer events; the wrapper carries the tooltip.
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">{button}</span>
      </TooltipTrigger>
      <TooltipContent>
        {t(
          isSyncPaused(record)
            ? "identity_sources.hints.syncNowPaused"
            : "identity_sources.hints.syncNowDisabled",
        )}
      </TooltipContent>
    </Tooltip>
  );
}
