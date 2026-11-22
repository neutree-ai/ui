import { useDelete, useNotification, useResource } from "@refinedev/core";
import type { Row } from "@tanstack/react-table";
import { Trash2 } from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { DeleteConfirmDialog } from "@/foundation/components/DeleteConfirmDialog";
import { buildBatchDeleteVariables } from "@/foundation/lib/batch-delete";
import { useTranslation } from "@/foundation/lib/i18n";

interface BatchDeleteBarProps {
  selectedRows: Row<any>[];
  onDeleted: () => void;
}

export function BatchDeleteBar({
  selectedRows,
  onDeleted,
}: BatchDeleteBarProps) {
  const { t } = useTranslation();
  const { resource } = useResource();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { mutateAsync: deleteOne } = useDelete();
  const { open: openNotification } = useNotification();

  const handleConfirm = useCallback(
    async (forceDelete: boolean) => {
      const resourceName = resource?.name || "";
      // Delete each row with ITS OWN metadata (workspace included) — a shared
      // meta cannot represent a multi-workspace selection, and dropping the
      // workspace makes the provider's re-read miss and crash. See
      // buildBatchDeleteVariables for the full rationale.
      const variables = buildBatchDeleteVariables(
        selectedRows,
        resourceName,
        forceDelete,
      );

      setSubmitting(true);
      try {
        const results = await Promise.allSettled(
          variables.map((variable) => deleteOne(variable)),
        );
        const succeeded = results.filter(
          (r) => r.status === "fulfilled",
        ).length;
        // Per-row success toasts are suppressed (see helper); emit one summary
        // so a 10-row delete does not spawn 10 notifications. Per-row failures
        // still surface via Refine's default error notification.
        if (succeeded > 0) {
          openNotification?.({
            type: "success",
            message: t("notifications.deleteSuccess", {
              resource: resourceName,
            }),
          });
          // Only clear the selection when something was actually deleted, so a
          // fully-failed batch keeps the rows selected for a retry.
          onDeleted();
        }
      } finally {
        setSubmitting(false);
        setOpen(false);
      }
    },
    [selectedRows, deleteOne, resource?.name, onDeleted, openNotification, t],
  );

  if (selectedRows.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground whitespace-nowrap">
        {t("table.selectedCount", { count: selectedRows.length })}
      </span>
      <DeleteConfirmDialog
        open={open}
        onOpenChange={setOpen}
        loading={submitting}
        title={t("dialogs.batchDelete.title", {
          count: selectedRows.length,
        })}
        description={t("dialogs.batchDelete.description")}
        onConfirm={handleConfirm}
      >
        <Button variant="destructive" data-testid="batch-delete-button">
          <Trash2 className="h-4 w-4" />
          {t("table.batchDelete")}
        </Button>
      </DeleteConfirmDialog>
    </div>
  );
}
