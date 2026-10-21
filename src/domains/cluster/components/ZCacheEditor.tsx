import { useCan, useInvalidate, useUpdate } from "@refinedev/core";
import { useState } from "react";
import { type FieldValues, FormProvider, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { zcacheSpec, zcacheStatus } from "@/domains/cluster/types";
import { getErrorMessage } from "@/foundation/lib/error-message";
import { useCacheCapacityConfirmation } from "../hooks/use-cache-capacity-confirmation";
import {
  activeCacheChange,
  cacheMessage,
  sameCacheConfig,
} from "../lib/zcache-presentation";
import type { Cluster } from "../types";
import { ZCacheFields } from "./ZCacheFields";

export function ZCacheEditor({
  cluster,
  onClose,
}: {
  cluster: Cluster;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { confirmCapacity, capacityConfirmation } =
    useCacheCapacityConfirmation();
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
  const close = () => {
    if (isLoading) return;
    if (form.formState.isDirty) setConfirmDiscard(true);
    else onClose();
  };
  const save = async () => {
    if (isLoading || access?.can !== true) return;
    setError("");
    const spec = structuredClone(cluster.spec);
    spec.cache = {
      provider: "zcache",
      options: {
        enabled: draft?.enabled === true,
        l1_size_gib: Number(draft?.l1_size_gib ?? 1),
        target_nodes: [...(draft?.target_nodes ?? [])],
      },
    };
    // Masked credentials must not overwrite the stored kubeconfig.
    if (
      spec.config.kubernetes_config &&
      !spec.config.kubernetes_config.kubeconfig
    )
      delete spec.config.kubernetes_config.kubeconfig;
    try {
      await mutateAsync({
        resource: "clusters",
        id: cluster.metadata.name,
        values: {
          spec,
          ...(cluster.status?.cache?.phase === "Failed"
            ? {
                metadata: {
                  ...cluster.metadata,
                  annotations: {
                    ...cluster.metadata.annotations,
                    "neutree.ai/zcache-retry": uuidv4(),
                  },
                },
              }
            : {}),
        },
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
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <SheetContent
        overlayClassName="bg-black/20"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-xl"
      >
        <SheetHeader className="border-b px-6 py-5 text-left">
          <SheetTitle>{t("clusters.zcache.edit")}</SheetTitle>
          <SheetDescription>
            {t("clusters.zcache.editDescription")}
          </SheetDescription>
        </SheetHeader>
        <FormProvider {...form}>
          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={form.handleSubmit(() => {
              confirmCapacity(zcacheSpec(cluster), draft, () => void save());
            })}
          >
            <fieldset
              disabled={isLoading}
              className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6"
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
            <div className="flex justify-end gap-2 border-t p-5">
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
                  (unchanged && cluster.status?.cache?.phase !== "Failed")
                }
              >
                {t(
                  isLoading
                    ? "clusters.zcache.saving"
                    : cluster.status?.cache?.phase === "Failed" && unchanged
                      ? "clusters.zcache.retry"
                      : "clusters.zcache.save",
                )}
              </Button>
            </div>
          </form>
        </FormProvider>
        {capacityConfirmation}
        <Dialog
          open={confirmDiscard}
          onOpenChange={(open) => {
            if (!open) setConfirmDiscard(false);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("clusters.zcache.discardTitle")}</DialogTitle>
              <DialogDescription>
                {t("clusters.zcache.discardDescription")}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setConfirmDiscard(false)}
              >
                {t("buttons.cancel")}
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  setConfirmDiscard(false);
                  onClose();
                }}
              >
                {t("clusters.zcache.discardTitle")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
}
