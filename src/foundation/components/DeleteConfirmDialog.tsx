import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/foundation/components/ConfirmDialog";
import { useTranslation } from "@/foundation/lib/i18n";
import {
  type PropsWithChildren,
  type ReactElement,
  useId,
  useState,
} from "react";

interface DeleteConfirmDialogProps extends PropsWithChildren {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  loading?: boolean;
  title?: string;
  description?: string;
  errorMessage?: string;
  onConfirm: (forceDelete: boolean) => void;
}

export function DeleteConfirmDialog({
  children,
  open,
  onOpenChange,
  loading = false,
  title,
  description,
  errorMessage,
  onConfirm,
}: DeleteConfirmDialogProps) {
  const { t } = useTranslation();
  const [forceDelete, setForceDelete] = useState(false);
  const checkboxId = useId();

  const handleOpenChange = (v: boolean) => {
    if (!loading) {
      onOpenChange?.(v);
      if (!v) setForceDelete(false);
    }
  };

  const handleConfirm = () => {
    onConfirm(forceDelete);
  };

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={handleOpenChange}
      loading={loading}
      title={title ?? t("dialogs.delete.title")}
      description={description ?? t("dialogs.delete.description")}
      okText={t("buttons.delete")}
      cancelText={t("buttons.cancel")}
      okButtonVariant="destructive"
      onConfirm={handleConfirm}
      content={
        <div className="space-y-4">
          {errorMessage && (
            <div className="rounded-md bg-destructive/10 p-3 max-h-40 overflow-y-auto">
              <div className="text-sm font-medium text-destructive mb-1">
                {t("dialogs.delete.currentError")}
              </div>
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-words">
                {errorMessage}
              </pre>
            </div>
          )}
          <div className="flex items-start space-x-3">
            <Checkbox
              id={checkboxId}
              checked={forceDelete}
              onCheckedChange={(checked) => setForceDelete(checked === true)}
            />
            <label
              htmlFor={checkboxId}
              className="text-sm leading-none cursor-pointer"
            >
              <div className="font-medium mb-1">
                {t("dialogs.delete.forceDelete.label")}
              </div>
              <div className="text-muted-foreground">
                {t("dialogs.delete.forceDelete.description")}
              </div>
            </label>
          </div>
        </div>
      }
    >
      {children as ReactElement}
    </ConfirmDialog>
  );
}
