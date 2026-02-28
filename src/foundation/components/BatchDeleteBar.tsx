import { Button } from "@/components/ui/button";
import { DeleteConfirmDialog } from "@/foundation/components/DeleteConfirmDialog";
import { useDeleteMany, useResource, useTranslate } from "@refinedev/core";
import type { Row } from "@tanstack/react-table";
import { Trash2 } from "lucide-react";
import { useCallback, useState } from "react";

interface BatchDeleteBarProps {
  selectedRows: Row<any>[];
  onDeleted: () => void;
}

export function BatchDeleteBar({
  selectedRows,
  onDeleted,
}: BatchDeleteBarProps) {
  const t = useTranslate();
  const { resource } = useResource();
  const [open, setOpen] = useState(false);
  const { mutate: deleteMany, isLoading } = useDeleteMany();

  const handleConfirm = useCallback(
    (forceDelete: boolean) => {
      const ids = selectedRows.map((row) => row.original.metadata?.name);
      deleteMany(
        {
          resource: resource?.name || "",
          ids,
          meta: forceDelete ? { forceDelete: true } : undefined,
        },
        {
          onSuccess: () => {
            setOpen(false);
            onDeleted();
          },
        },
      );
    },
    [selectedRows, deleteMany, resource?.name, onDeleted],
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
        loading={isLoading}
        title={t("dialogs.batchDelete.title", {
          count: selectedRows.length,
        })}
        description={t("dialogs.batchDelete.description")}
        onConfirm={handleConfirm}
      >
        <Button
          variant="destructive"
          size="sm"
          data-testid="batch-delete-button"
        >
          <Trash2 className="mr-1.5 h-4 w-4" />
          {t("table.batchDelete")}
        </Button>
      </DeleteConfirmDialog>
    </div>
  );
}
