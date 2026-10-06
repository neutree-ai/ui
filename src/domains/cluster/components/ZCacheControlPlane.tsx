import { useCan, useInvalidate, useUpdate } from "@refinedev/core";
import { useState } from "react";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShowPage } from "@/foundation/components/ShowPage";
import Timestamp from "@/foundation/components/Timestamp";
import { getErrorMessage } from "@/foundation/lib/error-message";
import type { Cluster } from "../types";

export function ZCacheControlPlane({ cluster }: { cluster: Cluster }) {
  const { t } = useTranslation();
  const { mutateAsync, isLoading } = useUpdate<Cluster>();
  const invalidate = useInvalidate();
  const { data: access } = useCan({ resource: "clusters", action: "edit" });
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState("");
  const state = cluster.status?.zcache?.control_plane;
  const intent = cluster.spec.zcache?.control_plane;
  const pending = !!intent && intent.request_id !== state?.request_id;
  const busy =
    pending || state?.phase === "Installing" || state?.phase === "Upgrading";
  const versions = (state?.available_versions ?? []).filter(
    (v) =>
      !state?.version ||
      v.version === state.version ||
      v.upgrade_from.includes(state.version),
  );
  const selected = versions.find((v) => v.version === target);
  const reapply = !!state?.version && target === state.version;
  const phase = pending ? "Pending" : state?.phase;
  const phaseText =
    phase === "Succeeded"
      ? t("clusters.zcache.controlPlane.succeeded")
      : phase === "Failed"
        ? t("clusters.zcache.controlPlane.failed")
        : phase === "Installing"
          ? t("clusters.zcache.controlPlane.installing")
          : phase === "Upgrading"
            ? t("clusters.zcache.controlPlane.upgrading")
            : t("clusters.zcache.controlPlane.pending");
  const submit = async () => {
    if (!selected || isLoading || busy) return;
    try {
      await mutateAsync({
        resource: "clusters",
        id: cluster.metadata.name,
        values: {
          spec: {
            ...cluster.spec,
            zcache: {
              ...(cluster.spec.zcache ?? {
                enabled: false,
                l1_size_gib: 1,
                target_nodes: [],
              }),
              control_plane: { version: target, request_id: uuidv4() },
            },
          },
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
      toast.success(t("clusters.zcache.controlPlane.submitted"));
      setOpen(false);
      await invalidate({
        resource: "clusters",
        id: cluster.metadata.name,
        invalidates: ["detail", "list"],
      });
    } catch (error) {
      toast.error(
        getErrorMessage(error, t("clusters.zcache.controlPlane.submitFailed")),
      );
    }
  };
  return (
    <div className="space-y-3 rounded-md border p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-medium">
          {t("clusters.zcache.controlPlane.title")}
        </h3>
        <Button
          variant="outline"
          disabled={access?.can !== true || busy || versions.length === 0}
          onClick={() => {
            setTarget(
              versions.find((v) => v.version !== state?.version)?.version ??
                versions[0]?.version ??
                "",
            );
            setOpen(true);
          }}
        >
          {t("clusters.zcache.controlPlane.manage")}
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <ShowPage.Row title={t("clusters.zcache.controlPlane.installed")}>
          {state?.version || "—"}
        </ShowPage.Row>
        <ShowPage.Row title={t("clusters.zcache.controlPlane.target")}>
          {intent?.version || state?.target_version || "—"}
        </ShowPage.Row>
        <ShowPage.Row title={t("clusters.zcache.controlPlane.result")}>
          {phaseText}
          {state?.revision ? ` · #${state.revision}` : ""}
        </ShowPage.Row>
        <ShowPage.Row title={t("clusters.zcache.controlPlane.health")}>
          {t(
            state?.ready ? "clusters.zcache.ready" : "clusters.zcache.notReady",
          )}
        </ShowPage.Row>
      </div>
      {!pending && state?.message && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}
      {state?.health_message && (
        <p className="text-sm text-destructive">{state.health_message}</p>
      )}
      {state?.completed_at && !pending && (
        <p className="text-xs text-muted-foreground">
          {t("clusters.zcache.controlPlane.completed")}{" "}
          <Timestamp timestamp={state.completed_at} />
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        {t("clusters.zcache.controlPlane.policy")}
      </p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("clusters.zcache.controlPlane.manage")}
            </DialogTitle>
            <DialogDescription>
              {t("clusters.zcache.controlPlane.impact")}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm">
            {t("clusters.zcache.controlPlane.installed")}:{" "}
            {state?.version || "—"}
          </p>
          <Label htmlFor="zcache-control-plane-version">
            {t("clusters.zcache.controlPlane.target")}
          </Label>
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger id="zcache-control-plane-version">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {versions.map((v) => (
                <SelectItem key={v.version} value={v.version}>
                  {v.version}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selected && (
            <div className="space-y-1 text-sm">
              <p>Chart: {selected.chart_version}</p>
              <p>Node agent: {selected.node_agent_version}</p>
              <p>
                {t("clusters.zcache.controlPlane.compatibility")}:{" "}
                {selected.runtime_versions.join(", ")}
              </p>
            </div>
          )}
          {reapply && (
            <p className="text-sm">
              {t("clusters.zcache.controlPlane.reapplyHint")}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("buttons.cancel")}
            </Button>
            <Button disabled={!selected || isLoading || busy} onClick={submit}>
              {t(
                reapply
                  ? "clusters.zcache.controlPlane.reapply"
                  : "clusters.zcache.controlPlane.confirm",
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
