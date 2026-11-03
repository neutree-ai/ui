import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  LoaderCircle,
  Settings2,
} from "lucide-react";
import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { readEndpointCacheManagerStatus } from "@/domains/endpoint/lib/cache-manager-status";
import { endpointZCacheOptions } from "@/domains/endpoint/lib/zcache";
import { EmptyState } from "@/foundation/components/EmptyState";
import FormCardGrid from "@/foundation/components/FormCardGrid";
import { FormFieldGroup } from "@/foundation/components/FormFieldGroup";
import { InfoHint } from "@/foundation/components/InfoHint";
import { useCacheVersions } from "@/foundation/hooks/use-cache-versions";
import { useSystemApi } from "@/foundation/hooks/use-system-api";
import { cn } from "@/foundation/lib/utils";
import type { EndpointClusterRef } from "../types";

export function EndpointKVCacheFields({
  form,
  cluster,
  cacheStatusLoading = false,
  acceleratorType,
  isEdit,
  cacheChanged = false,
  sectioned = false,
}: {
  form: UseFormReturn;
  cluster?: EndpointClusterRef;
  cacheStatusLoading?: boolean;
  acceleratorType?: string | null;
  isEdit: boolean;
  cacheChanged?: boolean;
  sectioned?: boolean;
}) {
  const { t } = useTranslation();
  const { systemInfo } = useSystemApi();
  const versions = useCacheVersions(
    systemInfo?.capabilities?.cluster_cache_providers?.includes("zcache") ===
      true,
  );
  const [configOpen, setConfigOpen] = useState(false);
  const cache = form.watch("spec.kv_cache");
  const enabled = cache != null;
  const engine = form.watch("spec.engine");
  const task = form.watch("spec.model.task");
  const runtimeVersion = endpointZCacheOptions(cluster)?.version;
  const availableEngineVersions =
    versions.data?.data.find((v) => v.version === runtimeVersion)
      ?.engine_versions ?? [];
  const compatible = availableEngineVersions.includes(engine?.version);
  const cacheManager = readEndpointCacheManagerStatus(
    cluster,
    cacheStatusLoading,
  );
  const managerReady = cacheManager.kind === "ready";
  const unavailableReason = (() => {
    if (
      cluster?.spec.type !== "kubernetes" ||
      !endpointZCacheOptions(cluster)?.enabled
    ) {
      return "endpoints.kvCacheSettings.unavailableCluster";
    }
    if (!acceleratorType) {
      return "endpoints.kvCacheSettings.unavailableAccelerator";
    }
    if (!acceleratorType.toLowerCase().includes("nvidia")) {
      return "endpoints.kvCacheSettings.unavailableAcceleratorVendor";
    }
    if (engine?.engine !== "vllm") {
      return "endpoints.kvCacheSettings.unavailableEngine";
    }
    if (task && task !== "text-generation") {
      return "endpoints.kvCacheSettings.unavailableTask";
    }
    if (!runtimeVersion) {
      return "endpoints.kvCacheSettings.unavailableRuntime";
    }
    if (cacheManager.kind === "loading") {
      return "endpoints.kvCacheSettings.checkingManager";
    }
    if (cacheManager.kind === "not-configured") {
      return "endpoints.kvCacheSettings.unavailableManager";
    }
    if (!managerReady) {
      return cacheManager.kind === "pending"
        ? "endpoints.kvCacheSettings.managerPending"
        : "endpoints.kvCacheSettings.managerUnavailable";
    }
    if (versions.isError) {
      return "endpoints.kvCacheSettings.unavailableRuntimeCheck";
    }
    if (versions.isLoading) {
      return "endpoints.kvCacheSettings.checkingRuntime";
    }
    if (availableEngineVersions.length > 0 && !compatible) {
      return "endpoints.kvCacheSettings.unavailableEngineVersion";
    }
    if (availableEngineVersions.length === 0) {
      return "endpoints.kvCacheSettings.noCompatibleEngineVersion";
    }
    return null;
  })();
  const supported = unavailableReason === null;
  form.register("spec.kv_cache", {
    validate: (value) =>
      value?.provider !== "zcache" ||
      !!supported ||
      t("endpoints.kvCacheSettings.requirements"),
  });
  if (cache?.provider && cache.provider !== "zcache") return null;
  if (
    !systemInfo?.capabilities?.cluster_cache_providers?.includes("zcache") &&
    !enabled
  )
    return null;
  const cacheSwitch = (
    <Switch
      {...(!sectioned ? { id: "endpoint-kv-cache-enabled" } : {})}
      aria-label={t("endpoints.kvCacheSettings.enable")}
      checked={enabled}
      disabled={!enabled && !supported}
      onCheckedChange={(value) => {
        form.setValue(
          "spec.kv_cache",
          value
            ? {
                provider: "zcache",
                options: {
                  timeout_seconds:
                    form.getValues("spec.kv_cache.options.timeout_seconds") ??
                    5,
                },
              }
            : null,
          { shouldDirty: true, shouldValidate: true },
        );
      }}
    />
  );
  const unavailableMessage = unavailableReason ? (
    <p
      data-testid="endpoint-kv-cache-unavailable"
      role="status"
      className="text-sm text-muted-foreground"
    >
      {unavailableReason !== "endpoints.kvCacheSettings.checkingRuntime" && (
        <>
          <span className="font-medium text-foreground">
            {t("endpoints.kvCacheSettings.unavailable")}
          </span>{" "}
        </>
      )}
      {t(unavailableReason, {
        phase:
          cacheManager.kind === "pending" || cacheManager.kind === "unavailable"
            ? cacheManager.phase
            : undefined,
      })}
    </p>
  ) : null;
  const cacheTimeoutField = cache?.provider ? (
    <FormFieldGroup
      {...form}
      name="spec.kv_cache.options.timeout_seconds"
      label={t("endpoints.kvCacheSettings.timeout")}
      description={t("endpoints.kvCacheSettings.timeoutHint")}
      rules={{
        validate: (value) =>
          !form.getValues("spec.kv_cache.provider") ||
          value === undefined ||
          (Number.isFinite(value) &&
            Number(value) >= 0.1 &&
            Number(value) <= 60) ||
          t("endpoints.kvCacheSettings.invalidTimeout"),
      }}
    >
      <Input
        type="number"
        min={0.1}
        max={60}
        step={0.1}
        value={form.watch("spec.kv_cache.options.timeout_seconds") ?? 5}
        onChange={(event) =>
          form.setValue(
            "spec.kv_cache.options.timeout_seconds",
            event.target.value === "" ? "" : Number(event.target.value),
            { shouldDirty: true, shouldValidate: true },
          )
        }
      />
    </FormFieldGroup>
  ) : null;
  const CacheManagerIcon =
    cacheManager.kind === "ready"
      ? CheckCircle2
      : cacheManager.kind === "loading" || cacheManager.kind === "pending"
        ? LoaderCircle
        : cacheManager.kind === "not-configured"
          ? AlertCircle
          : AlertTriangle;
  const cacheManagerText = (() => {
    switch (cacheManager.kind) {
      case "ready":
        return t("endpoints.kvCacheSettings.managerReady");
      case "loading":
        return t("endpoints.kvCacheSettings.managerLoading");
      case "pending":
        return t("endpoints.kvCacheSettings.managerPending", {
          phase: cacheManager.phase,
        });
      case "unavailable":
        return t("endpoints.kvCacheSettings.managerUnavailable");
      case "not-configured":
        return t("endpoints.kvCacheSettings.managerNotConfigured");
    }
  })();
  const cacheManagerTone =
    cacheManager.kind === "ready"
      ? "text-[var(--nt-text-colorful-positive)]"
      : cacheManager.kind === "loading" || cacheManager.kind === "pending"
        ? "text-[var(--nt-text-colorful-notice)]"
        : "text-destructive";
  const cacheManagerDetail =
    cacheManager.kind === "ready" ||
    cacheManager.kind === "pending" ||
    cacheManager.kind === "unavailable"
      ? cacheManager
      : null;
  const cacheManagerError =
    cacheManager.kind === "unavailable" ? cacheManager.errorMessage : null;
  const managerStatus =
    cacheManager.kind === "not-configured" ? null : (
      <div
        data-testid="endpoint-kv-cache-manager-status"
        data-l1-capacity={
          cacheManagerDetail?.l1CapacityGiB == null
            ? undefined
            : cacheManagerDetail.l1CapacityGiB
        }
        className="rounded-md border bg-muted/20 px-3 py-2.5"
      >
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <CacheManagerIcon
            aria-hidden="true"
            className={cn(
              "size-4 shrink-0",
              cacheManagerTone,
              cacheManager.kind === "loading" || cacheManager.kind === "pending"
                ? "motion-safe:animate-spin"
                : undefined,
            )}
          />
          <span className={cn("font-medium", cacheManagerTone)}>
            {cacheManagerText}
          </span>
          {cacheManagerDetail?.l1CapacityGiB != null && (
            <span className="text-muted-foreground">
              {t("endpoints.kvCacheSettings.l1Capacity", {
                capacity: cacheManagerDetail.l1CapacityGiB,
              })}
            </span>
          )}
        </div>
        {cacheManager.kind === "ready" && (
          <p className="mt-1 text-xs text-muted-foreground">
            {t("endpoints.kvCacheSettings.sharedPool")}
          </p>
        )}
        {cacheManagerError && (
          <p className="mt-1 break-words text-xs text-destructive">
            {cacheManagerError}
          </p>
        )}
      </div>
    );
  const content = (
    <>
      <div
        data-testid="endpoint-kv-cache-header"
        className={cn(
          "flex flex-wrap items-center justify-between gap-3",
          !sectioned && "bg-muted/50 px-4 py-3",
        )}
      >
        <div className="flex items-center gap-2">
          {sectioned ? (
            <h2 className="text-base font-semibold leading-6 text-[var(--nt-text-neutral-super)]">
              {t("endpoints.sections.kvCache")}
            </h2>
          ) : (
            <label
              htmlFor="endpoint-kv-cache-enabled"
              className="text-sm font-medium"
            >
              {t("endpoints.kvCacheSettings.enable")}
            </label>
          )}
          <InfoHint
            label={t(
              unavailableReason ?? "endpoints.kvCacheSettings.scheduling",
            )}
          />
        </div>
        <div className={cn("flex items-center gap-3", sectioned && "ml-auto")}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            onClick={() => setConfigOpen(true)}
          >
            <Settings2 className="mr-1.5 h-3.5 w-3.5" />
            {t("endpoints.kvCacheSettings.viewConfig")}
          </Button>
          {!sectioned && cacheSwitch}
        </div>
      </div>
      {sectioned && (
        <div className="mt-4 space-y-4">
          {managerStatus}
          <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <div
              data-testid="endpoint-kv-cache-toggle"
              className="w-fit min-w-0"
            >
              <FormFieldGroup
                {...form}
                name="spec.kv_cache"
                label={t("endpoints.kvCacheSettings.enableLabel")}
                className="flex flex-col items-start gap-2 space-y-0"
              >
                {cacheSwitch}
              </FormFieldGroup>
            </div>
            {enabled && cacheTimeoutField && (
              <div data-testid="endpoint-kv-cache-config" className="min-w-0">
                {cacheTimeoutField}
              </div>
            )}
            {unavailableMessage && (
              <div className="sm:col-span-2">{unavailableMessage}</div>
            )}
          </div>
        </div>
      )}
      {!sectioned && <div className="border-t px-4 py-3">{managerStatus}</div>}
      {!sectioned && unavailableMessage && (
        <div className="border-t px-4 py-3">{unavailableMessage}</div>
      )}
      {!sectioned && enabled && (
        <div className="space-y-5 p-4">
          <div className="max-w-sm">{cacheTimeoutField}</div>
        </div>
      )}
      {isEdit && cacheChanged && (
        <p
          role="status"
          className="flex items-center gap-2 border-t border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-400"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          {t("endpoints.kvCacheSettings.redeploy")}
        </p>
      )}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("endpoints.kvCacheSettings.configTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("endpoints.kvCacheSettings.configDescription")}
            </DialogDescription>
          </DialogHeader>
          {enabled ? (
            <dl className="divide-y rounded-md border px-3">
              {[
                [
                  t("endpoints.kvCacheSettings.provider"),
                  t("endpoints.kvCacheSettings.providerZCache"),
                ],
                [
                  t("endpoints.kvCacheSettings.offloadTarget"),
                  t("endpoints.kvCacheSettings.cpuMemory"),
                ],
                [
                  t("endpoints.kvCacheSettings.timeoutLabel"),
                  t("endpoints.kvCacheSettings.timeoutValue", {
                    seconds:
                      cache?.options?.timeout_seconds ??
                      form.getValues("spec.kv_cache.options.timeout_seconds") ??
                      5,
                  }),
                ],
                [
                  t("common.fields.cluster"),
                  cluster?.metadata.name ??
                    t("endpoints.kvCacheSettings.clusterNotSelected"),
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-4 py-3 text-sm"
                >
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="break-words text-right font-medium">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <EmptyState variant="inline">
              {t("endpoints.kvCacheSettings.noConfig")}
            </EmptyState>
          )}
          <p className="text-xs text-muted-foreground">
            {t("endpoints.kvCacheSettings.platformManaged")}
          </p>
        </DialogContent>
      </Dialog>
    </>
  );

  if (sectioned) {
    return (
      <FormCardGrid testId="endpoint-kv-cache-section" variant="section">
        <div className="col-span-4">{content}</div>
      </FormCardGrid>
    );
  }

  return (
    <section
      className="overflow-hidden rounded-md border bg-card"
      data-testid="endpoint-kv-cache"
    >
      {content}
    </section>
  );
}
