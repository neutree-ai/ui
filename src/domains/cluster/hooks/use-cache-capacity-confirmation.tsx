import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Capacity = { enabled?: boolean; l1_size_gib?: unknown };

export function useCacheCapacityConfirmation() {
  const { t } = useTranslation();
  const [pending, setPending] = useState<{
    save: () => void;
    disable: boolean;
  } | null>(null);
  const confirmCapacity = (
    before: Capacity | undefined,
    after: Capacity | undefined,
    save: () => void,
  ) => {
    if (
      before?.enabled &&
      (!after?.enabled ||
        Number(before.l1_size_gib) !== Number(after.l1_size_gib))
    ) {
      setPending({ save, disable: !after?.enabled });
    } else save();
  };
  const capacityConfirmation = (
    <Dialog
      open={pending !== null}
      onOpenChange={(open) => {
        if (!open) setPending(null);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t(
              pending?.disable
                ? "clusters.zcache.disableTitle"
                : "clusters.zcache.capacityChangeTitle",
            )}
          </DialogTitle>
          <DialogDescription>
            {t(
              pending?.disable
                ? "clusters.zcache.disableDescription"
                : "clusters.zcache.capacityChangeDescription",
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setPending(null)}>
            {t("buttons.cancel")}
          </Button>
          <Button
            variant={pending?.disable ? "destructive" : "default"}
            onClick={() => {
              const save = pending?.save;
              setPending(null);
              save?.();
            }}
          >
            {t(
              pending?.disable
                ? "clusters.zcache.disableTitle"
                : "clusters.zcache.confirmSave",
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
  return { confirmCapacity, capacityConfirmation };
}
