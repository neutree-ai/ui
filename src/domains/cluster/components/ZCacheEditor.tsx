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
import { getErrorMessage } from "@/foundation/lib/error-message";
import { activeCacheChange, sameCacheConfig } from "../lib/zcache-presentation";
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
  const form = useForm<FieldValues>({
    defaultValues: structuredClone(cluster),
  });
  const { data: access } = useCan({ resource: "clusters", action: "edit" });
  const { mutateAsync, isLoading } = useUpdate<Cluster>();
  const invalidate = useInvalidate();
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<"disable" | "discard" | null>(null);
  const status = cluster.status?.zcache;
  const draft = form.watch("spec.zcache");
  const unchanged = sameCacheConfig(draft, cluster.spec.zcache);
  const busy = activeCacheChange(status);
  const close = () => {
    if (isLoading) return;
    if (form.formState.isDirty) setConfirm("discard");
    else onClose();
  };
  const save = async () => {
    if (!draft || isLoading || access?.can !== true) return;
    setError("");
    const spec = structuredClone(cluster.spec);
    spec.zcache = {
      ...spec.zcache,
      enabled: draft.enabled,
      l1_size_gib: Number(draft.l1_size_gib),
      target_nodes: [...draft.target_nodes],
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
          ...(status?.phase === "Failed"
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
              if (cluster.spec.zcache?.enabled && !draft?.enabled)
                setConfirm("disable");
              else void save();
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
              <ZCacheFields form={form} isEdit status={status} compact />
              {error && (
                <p
                  role="alert"
                  className="break-words text-sm text-destructive"
                >
                  {error}
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
                  (unchanged && status?.phase !== "Failed")
                }
              >
                {t(
                  isLoading
                    ? "clusters.zcache.saving"
                    : status?.phase === "Failed" && unchanged
                      ? "clusters.zcache.retry"
                      : "clusters.zcache.save",
                )}
              </Button>
            </div>
          </form>
        </FormProvider>
        <Dialog
          open={confirm !== null}
          onOpenChange={(open) => {
            if (!open) setConfirm(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {t(
                  confirm === "disable"
                    ? "clusters.zcache.disableTitle"
                    : "clusters.zcache.discardTitle",
                )}
              </DialogTitle>
              <DialogDescription>
                {t(
                  confirm === "disable"
                    ? "clusters.zcache.disableDescription"
                    : "clusters.zcache.discardDescription",
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirm(null)}>
                {t("buttons.cancel")}
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  const action = confirm;
                  setConfirm(null);
                  if (action === "disable") void save();
                  else onClose();
                }}
              >
                {t(
                  confirm === "disable"
                    ? "clusters.zcache.disableTitle"
                    : "clusters.zcache.discardTitle",
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
}
