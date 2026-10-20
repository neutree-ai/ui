import {
  type PropsWithChildren,
  type ReactElement,
  useEffect,
  useId,
  useState,
} from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/foundation/components/ConfirmDialog";
import { useTranslation } from "@/foundation/lib/i18n";

/** Per-resource strengthening of the delete confirmation. */
export type DeleteConfirmation = {
  /** Replaces the default "cannot be undone" text, e.g. to state the impact. */
  description?: string;
  /** When set, Delete stays disabled until the user types this exact text. */
  confirmName?: string;
  /** Show the force-delete option. Defaults to true. */
  allowForceDelete?: boolean;
};

interface DeleteConfirmDialogProps
  extends PropsWithChildren,
    DeleteConfirmation {
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
  confirmName,
  allowForceDelete = true,
}: DeleteConfirmDialogProps) {
  const { t } = useTranslation();
  const [forceDelete, setForceDelete] = useState(false);
  const [typedName, setTypedName] = useState("");
  const checkboxId = useId();
  const typedNameId = useId();

  // The provider also closes the dialog by itself after a delete succeeds.
  useEffect(() => {
    if (!open) setTypedName("");
  }, [open]);

  const handleOpenChange = (v: boolean) => {
    if (!loading) {
      onOpenChange?.(v);
      if (!v) {
        setForceDelete(false);
        setTypedName("");
      }
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
      okDisabled={Boolean(confirmName) && typedName !== confirmName}
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
          {confirmName && (
            <div className="space-y-2">
              <label htmlFor={typedNameId} className="text-sm">
                {t("dialogs.delete.typeNameToConfirm", { name: confirmName })}
              </label>
              <Input
                id={typedNameId}
                value={typedName}
                autoComplete="off"
                data-testid="delete-confirm-name"
                onChange={(e) => setTypedName(e.target.value)}
              />
            </div>
          )}
          {allowForceDelete && (
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
          )}
        </div>
      }
    >
      {children as ReactElement}
    </ConfirmDialog>
  );
}
