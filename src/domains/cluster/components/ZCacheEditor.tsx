import { useCan, useInvalidate, useUpdate } from "@refinedev/core";
import { useState } from "react";
import { type FieldValues, FormProvider, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/foundation/lib/utils";
import { getErrorMessage } from "@/foundation/scene/error-message";
import { useCacheCapacityConfirmation } from "../hooks/use-cache-capacity-confirmation";
import { zcacheSaveValues } from "../lib/zcache-form";
import {
  activeCacheChange,
  cacheFailed,
  cacheMessage,
  sameCacheConfig,
} from "../lib/zcache-presentation";
import { type Cluster, zcacheSpec, zcacheStatus } from "../types";
import { ZCacheFields } from "./ZCacheFields";

export function ZCacheEditor({
  cluster,
  onClose,
}: {
  cluster: Cluster;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const {
    confirmCapacity,
    pending: capacityConfirmation,
    cancel: cancelCapacityConfirmation,
    confirm: confirmCapacityChange,
  } = useCacheCapacityConfirmation();
  const form = useForm<FieldValues>({
    defaultValues: structuredClone(cluster),
  });
  const { data: access } = useCan({ resource: "clusters", action: "edit" });
  const { mutateAsync, isLoading } = useUpdate<Cluster>();
  const invalidate = useInvalidate();
  const [error, setError] = useState("");
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const status = zcacheStatus(cluster);
  const draft = form.watch("spec.cache.options");
  const unchanged = sameCacheConfig(draft, zcacheSpec(cluster));
  const busy = activeCacheChange(status);
  const failed = cacheFailed(cluster.status?.cache);
  const confirming = capacityConfirmation !== null || confirmDiscard;

  const close = () => {
    if (isLoading) return;
    if (capacityConfirmation || confirmDiscard) {
      cancelCapacityConfirmation();
      setConfirmDiscard(false);
      return;
    }
    if (!unchanged) setConfirmDiscard(true);
    else onClose();
  };

  const save = async () => {
    if (isLoading || access?.can !== true) return;
    setError("");
    try {
      await mutateAsync({
        resource: "clusters",
        id: cluster.metadata.name,
        values: zcacheSaveValues(cluster, draft),
        meta: {
          idColumnName: "metadata->name",
          workspace: cluster.metadata.workspace,
          workspaced: true,
        },
        mutationMode: "pessimistic",
        successNotification: false,
        errorNotification: false,
      });
      toast.success(
        t(busy ? "clusters.zcache.queuedSaved" : "clusters.zcache.saved"),
      );
      await invalidate({
        resource: "clusters",
        id: cluster.metadata.name,
        invalidates: ["detail", "list"],
      });
      onClose();
    } catch (e) {
      setError(getErrorMessage(e, t("clusters.zcache.saveFailed")));
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent
        className={cn(
          "flex min-w-0 max-h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0",
          confirming ? "max-w-[560px]" : "max-w-[920px]",
        )}
      >
        {capacityConfirmation ? (
          <>
            <DialogHeader className="px-6 py-5 text-left">
              <DialogTitle>
                {t(
                  capacityConfirmation.disable
                    ? "clusters.zcache.disableTitle"
                    : "clusters.zcache.capacityChangeTitle",
                )}
              </DialogTitle>
              <DialogDescription>
                {t(
                  capacityConfirmation.disable
                    ? "clusters.zcache.disableDescription"
                    : "clusters.zcache.capacityChangeDescription",
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex flex-col gap-2 border-t px-6 py-4 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={cancelCapacityConfirmation}
              >
                {t("buttons.cancel")}
              </Button>
              <Button
                type="button"
                variant={
                  capacityConfirmation.disable ? "destructive" : "default"
                }
                onClick={confirmCapacityChange}
              >
                {t(
                  capacityConfirmation.disable
                    ? "clusters.zcache.disableTitle"
                    : "clusters.zcache.confirmSave",
                )}
              </Button>
            </DialogFooter>
          </>
        ) : confirmDiscard ? (
          <>
            <DialogHeader className="px-6 py-5 text-left">
              <DialogTitle>{t("clusters.zcache.discardTitle")}</DialogTitle>
              <DialogDescription>
                {t("clusters.zcache.discardDescription")}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex flex-col gap-2 border-t px-6 py-4 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmDiscard(false)}
              >
                {t("buttons.cancel")}
              </Button>
              <Button type="button" variant="destructive" onClick={onClose}>
                {t("clusters.zcache.discardTitle")}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader className="border-b px-6 py-5 text-left">
              <DialogTitle>{t("clusters.zcache.edit")}</DialogTitle>
              <DialogDescription>
                {t("clusters.zcache.editDescription")}
              </DialogDescription>
            </DialogHeader>
            <FormProvider {...form}>
              <form
                className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
                onSubmit={form.handleSubmit(() => {
                  confirmCapacity(
                    zcacheSpec(cluster),
                    draft,
                    () => void save(),
                  );
                })}
              >
                <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-6 py-5">
                  <fieldset
                    disabled={isLoading}
                    className="m-0 min-w-0 space-y-5 border-0 p-0"
                  >
                    {busy && (
                      <p
                        role="status"
                        className="rounded-md bg-primary/5 p-3 text-sm leading-6 text-primary"
                      >
                        {t("clusters.zcache.editWhileBusy")}
                      </p>
                    )}
                    <ZCacheFields
                      form={form}
                      isEdit
                      status={status}
                      summary={cluster.status?.cache}
                      compact
                    />
                    {error && (
                      <p
                        role="alert"
                        className="break-words text-sm text-destructive"
                      >
                        {cacheMessage(error, t("clusters.zcache.serviceName"))}
                      </p>
                    )}
                  </fieldset>
                </div>
                <DialogFooter className="shrink-0 flex flex-col gap-2 border-t bg-popover px-6 py-4 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isLoading}
                    onClick={close}
                  >
                    {t("buttons.cancel")}
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      isLoading ||
                      access?.can !== true ||
                      (unchanged && !failed)
                    }
                  >
                    {t(
                      isLoading
                        ? "clusters.zcache.saving"
                        : failed && unchanged
                          ? "clusters.zcache.retry"
                          : "clusters.zcache.save",
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </FormProvider>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
