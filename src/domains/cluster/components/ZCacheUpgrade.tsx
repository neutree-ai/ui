import {
  useCan,
  useCustomMutation,
  useInvalidate,
  useList,
} from "@refinedev/core";
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
import { useCacheVersions } from "@/foundation/hooks/use-cache-versions";
import { getErrorMessage } from "@/foundation/lib/error-message";
import { type Cluster, zcacheSpec, zcacheStatus } from "../types";

type Instance = {
  id: number;
  metadata: {
    name: string;
    display_name?: string;
    annotations?: Record<string, string>;
  };
  spec: {
    engine: { engine: string; version: string };
    kv_cache?: { provider: string };
    replicas?: { num: number };
  };
};
const signatureKey = "neutree.ai/resource-spec-signature";

export function ZCacheUpgrade({ cluster }: { cluster: Cluster }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { data: permission } = useCan({ resource: "clusters", action: "edit" });
  const status = zcacheStatus(cluster);
  let requestedId: string | undefined;
  try {
    requestedId = JSON.parse(
      cluster.metadata.annotations?.["neutree.ai/cache-upgrade"] ?? "{}",
    ).id;
  } catch {
    // Malformed external annotations do not hide the last observed status.
  }
  const upgrade =
    requestedId && requestedId !== status?.upgrade?.id
      ? { id: requestedId, phase: "UpdatingRuntime", endpoints: [] }
      : status?.upgrade;
  const busy = upgrade && !["Succeeded", "Failed"].includes(upgrade.phase);
  return (
    <div className="space-y-3 rounded-md border p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm">
          <div>
            {t("clusters.cacheUpgrade.current", {
              version:
                status?.ready_runtime_version ?? t("clusters.zcache.unknown"),
            })}
          </div>
          {zcacheSpec(cluster)?.version &&
            zcacheSpec(cluster)?.version !== status?.ready_runtime_version && (
              <div className="text-muted-foreground">
                {t("clusters.cacheUpgrade.target", {
                  version: zcacheSpec(cluster)?.version,
                })}
              </div>
            )}
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={
            permission?.can !== true || !zcacheSpec(cluster)?.enabled || !!busy
          }
          onClick={() => setOpen(true)}
        >
          {t("clusters.cacheUpgrade.title")}
        </Button>
      </div>
      {upgrade && upgrade.phase !== "Succeeded" && (
        <div role="status" className="space-y-1 text-sm">
          <p>{t(`clusters.cacheUpgrade.phases.${upgrade.phase}`)}</p>
          {upgrade.endpoints.map((ep) => (
            <div key={ep.name} className="flex flex-wrap gap-2">
              <a
                className="underline"
                href={`#/${encodeURIComponent(cluster.metadata.workspace ?? "default")}/endpoints/show/${encodeURIComponent(ep.name)}`}
              >
                {ep.name}
              </a>
              <span>{t(`clusters.cacheUpgrade.phases.${ep.phase}`)}</span>
              {ep.message && (
                <span className="text-destructive">{ep.message}</span>
              )}
            </div>
          ))}
        </div>
      )}
      {open && (
        <UpgradeDialog cluster={cluster} onClose={() => setOpen(false)} />
      )}
    </div>
  );
}

function UpgradeDialog({
  cluster,
  onClose,
}: {
  cluster: Cluster;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const versions = useCacheVersions();
  const {
    data: endpoints,
    isLoading: loadingEndpoints,
    error: endpointError,
  } = useList<Instance>({
    resource: "endpoints",
    pagination: { mode: "off" },
    filters: [
      { field: "spec->>cluster", operator: "eq", value: cluster.metadata.name },
    ],
    meta: { workspace: cluster.metadata.workspace, workspaced: true },
  });
  const { data: engines } = useList<{
    id: number;
    metadata: { name: string };
    spec: { versions: { version: string }[] };
  }>({
    resource: "engines",
    pagination: { mode: "off" },
    meta: { workspace: cluster.metadata.workspace, workspaced: true },
  });
  const { data: permission } = useCan({
    resource: "endpoints",
    action: "edit",
  });
  const { mutateAsync, isLoading } = useCustomMutation();
  const invalidate = useInvalidate();
  const [selected, setVersion] = useState("");
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const candidates = (versions.data?.data ?? []).filter(
    (v) => v.version !== zcacheStatus(cluster)?.ready_runtime_version,
  );
  const version =
    candidates.find((v) => v.version === selected)?.version ??
    candidates[0]?.version ??
    "";
  const affected = (endpoints?.data ?? []).filter(
    (ep) => ep.spec.kv_cache?.provider === "zcache",
  );
  const supported =
    versions.data?.data.find((v) => v.version === version)?.engine_versions ??
    [];
  const installed =
    engines?.data
      .find((e) => e.metadata.name === "vllm")
      ?.spec.versions.map((v) => v.version) ?? [];
  const selection = (ep: Instance) =>
    choices[ep.metadata.name] ??
    (supported.includes(ep.spec.engine.version) ? "keep" : "");
  const valid =
    !!version &&
    !loadingEndpoints &&
    !endpointError &&
    !versions.error &&
    (affected.length === 0 || permission?.can === true) &&
    affected.every((ep) => selection(ep));
  async function submit() {
    if (!valid) return;
    setError("");
    try {
      await mutateAsync({
        url: "/rpc/upgrade_zcache",
        method: "post",
        values: {
          p_cluster_id: cluster.id,
          p_version: version,
          p_expected_signature: cluster.metadata.annotations?.[signatureKey],
          p_endpoints: affected.map((ep) => ({
            name: ep.metadata.name,
            expected_signature: ep.metadata.annotations?.[signatureKey],
            disable_cache: selection(ep) === "disable",
            engine_version: ["keep", "disable"].includes(selection(ep))
              ? ""
              : selection(ep),
          })),
        },
        successNotification: false,
        errorNotification: false,
      });
      await Promise.all(
        ["clusters", "endpoints"].map((resource) =>
          invalidate({ resource, invalidates: ["list", "detail"] }),
        ),
      );
      onClose();
    } catch (e) {
      setError(getErrorMessage(e, t("clusters.zcache.saveFailed")));
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(value) => {
        if (!value && !isLoading) onClose();
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("clusters.cacheUpgrade.title")}</DialogTitle>
          <DialogDescription>
            {t("clusters.cacheUpgrade.description")}
          </DialogDescription>
        </DialogHeader>
        <label className="space-y-2 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">
              {t("clusters.cacheUpgrade.selectVersion")}
            </span>
            <span className="text-xs text-muted-foreground">
              {t("clusters.cacheUpgrade.current", {
                version:
                  zcacheStatus(cluster)?.ready_runtime_version ??
                  t("clusters.zcache.unknown"),
              })}
            </span>
          </div>
          <select
            className="block w-full rounded-md border bg-background p-2"
            value={version}
            disabled={isLoading}
            onChange={(e) => {
              setVersion(e.target.value);
              setChoices({});
            }}
          >
            {candidates.length === 0 && <option value="" />}
            {candidates.map((v) => (
              <option key={v.version} value={v.version}>
                {v.engine_versions.length > 0
                  ? `${v.version} (vLLM ${v.engine_versions.join(", ")})`
                  : v.version}
              </option>
            ))}
          </select>
        </label>
        <div className="max-h-80 space-y-3 overflow-auto">
          {affected.map((ep) => (
            <div
              key={ep.id}
              className="grid grid-cols-2 items-center gap-3 rounded border p-3"
            >
              <div className="text-sm">
                {ep.metadata.display_name || ep.metadata.name}
                <div className="text-xs text-muted-foreground">
                  <span>{ep.spec.engine.version}</span>
                  {version && !supported.includes(ep.spec.engine.version) && (
                    <span className="text-amber-600 dark:text-amber-400">
                      {` · ${t("clusters.cacheUpgrade.incompatibleTarget")}`}
                    </span>
                  )}
                  {ep.spec.replicas?.num === 0 &&
                    ` · ${t("clusters.cacheUpgrade.phases.Paused")}`}
                </div>
              </div>
              <select
                aria-label={ep.metadata.name}
                className={`rounded-md border bg-background p-2 text-sm ${
                  version && !selection(ep)
                    ? "border-amber-500/80"
                    : ""
                }`}
                disabled={!version || isLoading}
                value={selection(ep)}
                onChange={(e) =>
                  setChoices((old) => ({
                    ...old,
                    [ep.metadata.name]: e.target.value,
                  }))
                }
              >
                <option value="" disabled>
                  {t("clusters.cacheUpgrade.chooseAction")}
                </option>
                {supported.includes(ep.spec.engine.version) && (
                  <option value="keep">
                    {t("clusters.cacheUpgrade.keep")}
                  </option>
                )}
                {supported
                  .filter(
                    (v) =>
                      installed.includes(v) && v !== ep.spec.engine.version,
                  )
                  .map((v) => (
                    <option key={v} value={v}>
                      {t("clusters.cacheUpgrade.engine", { version: v })}
                    </option>
                  ))}
                <option value="disable">
                  {t("clusters.cacheUpgrade.disable")}
                </option>
              </select>
            </div>
          ))}
          {!loadingEndpoints && affected.length === 0 && (
            <p className="text-sm">{t("clusters.cacheUpgrade.noInstances")}</p>
          )}
        </div>
        {(error || endpointError || versions.error) && (
          <p role="alert" className="text-sm text-destructive">
            {error || t("clusters.cacheUpgrade.loadFailed")}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" disabled={isLoading} onClick={onClose}>
            {t("buttons.cancel")}
          </Button>
          <Button disabled={!valid || isLoading} onClick={() => void submit()}>
            {t("clusters.cacheUpgrade.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
