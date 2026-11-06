import {
  useCan,
  useCustomMutation,
  useInvalidate,
  useList,
} from "@refinedev/core";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link } from "@/foundation/components/Link";
import { useCacheVersions } from "@/foundation/hooks/use-cache-versions";
import { engineVersionsFor } from "@/foundation/lib/cache-versions";
import { getErrorMessage } from "@/foundation/lib/error-message";
import {
  type CacheDependentEndpoint,
  defaultUpgradeAction,
  effectiveUpgrade,
  RESOURCE_SPEC_SIGNATURE,
  upgradeEndpointPayload,
  upgradeEngineTargets,
  upgradeInProgress,
} from "../lib/zcache-upgrade";
import { type Cluster, zcacheSpec, zcacheStatus } from "../types";

export function ZCacheUpgrade({ cluster }: { cluster: Cluster }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { data: permission } = useCan({ resource: "clusters", action: "edit" });
  const spec = zcacheSpec(cluster);
  const readyVersion = zcacheStatus(cluster)?.ready_runtime_version;
  const upgrade = effectiveUpgrade(cluster);
  return (
    <div className="space-y-3 rounded-md border p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm">
          <div>
            {t("clusters.cacheUpgrade.current", {
              version: readyVersion ?? t("clusters.zcache.unknown"),
            })}
          </div>
          {spec?.version && spec.version !== readyVersion && (
            <div className="text-muted-foreground">
              {t("clusters.cacheUpgrade.target", { version: spec.version })}
            </div>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={
            permission?.can !== true ||
            !spec?.enabled ||
            upgradeInProgress(upgrade)
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
              <Link
                className="underline"
                href={`/${encodeURIComponent(cluster.metadata.workspace ?? "default")}/endpoints/show/${encodeURIComponent(ep.name)}`}
              >
                {ep.name}
              </Link>
              <span>{t(`clusters.cacheUpgrade.phases.${ep.phase}`)}</span>
              {ep.message && (
                <span className="text-destructive">{ep.message}</span>
              )}
            </div>
          ))}
        </div>
      )}
      {open && (
        <UpgradeDialog
          cluster={cluster}
          readyVersion={readyVersion}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function UpgradeDialog({
  cluster,
  readyVersion,
  onClose,
}: {
  cluster: Cluster;
  readyVersion?: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const versions = useCacheVersions();
  const {
    data: endpoints,
    isLoading: loadingEndpoints,
    error: endpointError,
  } = useList<CacheDependentEndpoint>({
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
    filters: [{ field: "metadata->>name", operator: "eq", value: "vllm" }],
    meta: { workspace: cluster.metadata.workspace, workspaced: true },
  });
  const { data: permission } = useCan({
    resource: "endpoints",
    action: "edit",
  });
  const { mutateAsync, isLoading } = useCustomMutation();
  const invalidate = useInvalidate();
  const [selected, setSelected] = useState("");
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const candidates = (versions.data?.data ?? []).filter(
    (v) => v.version !== readyVersion,
  );
  const version = candidates.some((v) => v.version === selected)
    ? selected
    : (candidates[0]?.version ?? "");
  const affected = (endpoints?.data ?? []).filter(
    (ep) => ep.spec.kv_cache?.provider === "zcache",
  );
  const supported = engineVersionsFor(versions.data?.data, version);
  const installed = engines?.data[0]?.spec.versions.map((v) => v.version) ?? [];
  const selection = (ep: CacheDependentEndpoint) =>
    choices[ep.metadata.name] ??
    defaultUpgradeAction(ep.spec.engine.version, supported);
  const valid =
    !!version &&
    !loadingEndpoints &&
    !endpointError &&
    !versions.error &&
    (affected.length === 0 || permission?.can === true) &&
    affected.every((ep) => selection(ep));
  async function submit() {
    setError("");
    try {
      await mutateAsync({
        url: "/rpc/upgrade_zcache",
        method: "post",
        values: {
          p_cluster_id: cluster.id,
          p_version: version,
          p_expected_signature:
            cluster.metadata.annotations?.[RESOURCE_SPEC_SIGNATURE],
          p_endpoints: affected.map((ep) =>
            upgradeEndpointPayload(ep, selection(ep)),
          ),
        },
        successNotification: false,
        errorNotification: false,
      });
      onClose();
      for (const resource of ["clusters", "endpoints"]) {
        void invalidate({ resource, invalidates: ["list", "detail"] });
      }
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
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">
              {t("clusters.cacheUpgrade.selectVersion")}
            </span>
            <span className="text-xs text-muted-foreground">
              {t("clusters.cacheUpgrade.current", {
                version: readyVersion ?? t("clusters.zcache.unknown"),
              })}
            </span>
          </div>
          <Combobox
            modal
            asField={false}
            allowUnselect={false}
            value={version}
            disabled={isLoading || candidates.length === 0}
            placeholder={
              versions.isLoading
                ? t("loading")
                : t("clusters.messages.noUpgradeVersions")
            }
            options={candidates.map((v) => ({
              value: v.version,
              label:
                v.engine_versions.length > 0
                  ? `${v.version} (vLLM ${v.engine_versions.join(", ")})`
                  : v.version,
            }))}
            onChange={(value) => {
              setSelected(value);
              setChoices({});
            }}
          />
        </div>
        <div className="max-h-80 space-y-3 overflow-auto">
          {affected.map((ep) => {
            const compatible = supported.includes(ep.spec.engine.version);
            const action = selection(ep);
            return (
              <div
                key={ep.id}
                className="grid grid-cols-2 items-center gap-3 rounded border p-3"
              >
                <div className="text-sm">
                  {ep.metadata.name}
                  <div className="text-xs text-muted-foreground">
                    <span>{ep.spec.engine.version}</span>
                    {version && !compatible && (
                      <span className="text-amber-600 dark:text-amber-400">
                        {` · ${t("clusters.cacheUpgrade.incompatibleTarget")}`}
                      </span>
                    )}
                    {ep.spec.replicas?.num === 0 &&
                      ` · ${t("clusters.cacheUpgrade.phases.Paused")}`}
                  </div>
                </div>
                <Select
                  disabled={!version || isLoading}
                  value={action || undefined}
                  onValueChange={(value) =>
                    setChoices((old) => ({
                      ...old,
                      [ep.metadata.name]: value,
                    }))
                  }
                >
                  <SelectTrigger
                    aria-label={ep.metadata.name}
                    className={
                      version && !action ? "border-amber-500/80" : undefined
                    }
                  >
                    <SelectValue
                      placeholder={t("clusters.cacheUpgrade.chooseAction")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {compatible && (
                      <SelectItem value="keep">
                        {t("clusters.cacheUpgrade.keep")}
                      </SelectItem>
                    )}
                    {upgradeEngineTargets(
                      ep.spec.engine.version,
                      supported,
                      installed,
                    ).map((v) => (
                      <SelectItem key={v} value={v}>
                        {t("clusters.cacheUpgrade.engine", { version: v })}
                      </SelectItem>
                    ))}
                    <SelectItem value="disable">
                      {t("clusters.cacheUpgrade.disable")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            );
          })}
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
