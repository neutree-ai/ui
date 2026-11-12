import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  LoaderCircle,
  type LucideIcon,
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
import type { KvCacheAvailability } from "@/domains/endpoint/hooks/use-kv-cache-availability";
import type { EndpointCacheManagerStatus } from "@/domains/endpoint/lib/cache-manager-status";
import { EmptyState } from "@/foundation/components/EmptyState";
import FormCardGrid from "@/foundation/components/FormCardGrid";
import { FormFieldGroup } from "@/foundation/components/FormFieldGroup";
import { InfoHint } from "@/foundation/components/InfoHint";
import { cn } from "@/foundation/lib/utils";
import type { EndpointClusterRef } from "../types";

const CACHE_MANAGER_DISPLAY: Record<
  EndpointCacheManagerStatus["kind"],
  { icon: LucideIcon; key: string; tone: string; spin: boolean }
> = {
  ready: {
    icon: CheckCircle2,
    key: "endpoints.kvCacheSettings.managerReady",
    tone: "text-[var(--nt-text-colorful-positive)]",
    spin: false,
  },
  loading: {
    icon: LoaderCircle,
    key: "endpoints.kvCacheSettings.managerLoading",
    tone: "text-[var(--nt-text-colorful-notice)]",
    spin: true,
  },
  pending: {
    icon: LoaderCircle,
    key: "endpoints.kvCacheSettings.managerPending",
    tone: "text-[var(--nt-text-colorful-notice)]",
    spin: true,
  },
  unavailable: {
    icon: AlertTriangle,
    key: "endpoints.kvCacheSettings.managerUnavailable",
    tone: "text-destructive",
    spin: false,
  },
  "not-configured": {
    icon: AlertCircle,
    key: "endpoints.kvCacheSettings.managerNotConfigured",
    tone: "text-destructive",
    spin: false,
  },
};

const CACHE_MANAGER_PHASE_KEYS: Readonly<Record<string, string>> = {
  Ready: "endpoints.kvCacheSettings.phases.Ready",
  Reconciling: "endpoints.kvCacheSettings.phases.Reconciling",
  Failed: "endpoints.kvCacheSettings.phases.Failed",
  Unavailable: "endpoints.kvCacheSettings.phases.Unavailable",
  Disabled: "endpoints.kvCacheSettings.phases.Disabled",
  Unknown: "endpoints.kvCacheSettings.phases.Unknown",
};

export function EndpointKVCacheFields({
  form,
  cluster,
  availability: { hasZCache, cacheManager, unavailableReason },
  isEdit,
  cacheChanged = false,
}: {
  form: UseFormReturn;
  cluster?: EndpointClusterRef;
  availability: KvCacheAvailability;
  isEdit: boolean;
  cacheChanged?: boolean;
}) {
  const { t } = useTranslation();
  const [configOpen, setConfigOpen] = useState(false);
  const cache = form.watch("spec.kv_cache");
  const enabled = cache != null;
  const phaseKey =
    "phase" in cacheManager
      ? CACHE_MANAGER_PHASE_KEYS[cacheManager.phase]
      : undefined;
  const phaseValues =
    "phase" in cacheManager
      ? { phase: phaseKey ? t(phaseKey) : cacheManager.phase }
      : {};
  const supported = unavailableReason === null;
  if (cache?.provider && cache.provider !== "zcache") return null;
  if (!hasZCache && !enabled) return null;
  const cacheSwitch = (
    <Switch
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
    <p role="status" className="text-sm text-muted-foreground">
      {unavailableReason !== "endpoints.kvCacheSettings.checkingRuntime" && (
        <>
          <span className="font-medium text-foreground">
            {t("endpoints.kvCacheSettings.unavailable")}
          </span>{" "}
        </>
      )}
      {t(unavailableReason, phaseValues)}
    </p>
  ) : null;
  const cacheTimeoutField = cache?.provider ? (
    <FormFieldGroup
      {...form}
      name="spec.kv_cache.options.timeout_seconds"
      label={t("endpoints.kvCacheSettings.timeout")}
      description={t("endpoints.kvCacheSettings.timeoutHint")}
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
  const managerDisplay = CACHE_MANAGER_DISPLAY[cacheManager.kind];
  const CacheManagerIcon = managerDisplay.icon;
  const l1CapacityGiB =
    "l1CapacityGiB" in cacheManager ? cacheManager.l1CapacityGiB : null;
  const cacheManagerError =
    cacheManager.kind === "unavailable" ? cacheManager.errorMessage : null;
  const managerStatus =
    cacheManager.kind === "not-configured" ? null : (
      <div className="rounded-md border bg-muted/20 px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <CacheManagerIcon
            aria-hidden="true"
            className={cn(
              "size-4 shrink-0",
              managerDisplay.tone,
              managerDisplay.spin ? "motion-safe:animate-spin" : undefined,
            )}
          />
          <span className={cn("font-medium", managerDisplay.tone)}>
            {t(managerDisplay.key, phaseValues)}
          </span>
          {l1CapacityGiB != null && (
            <span className="text-muted-foreground">
              {t("endpoints.kvCacheSettings.l1Capacity", {
                capacity: l1CapacityGiB,
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold leading-6 text-[var(--nt-text-neutral-super)]">
            {t("endpoints.sections.kvCache")}
          </h2>
          <InfoHint
            label={t(
              unavailableReason ?? "endpoints.kvCacheSettings.scheduling",
              phaseValues,
            )}
          />
        </div>
        <div className="ml-auto flex items-center gap-3">
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
        </div>
      </div>
      <div className="mt-4 space-y-4">
        {managerStatus}
        <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          <div className="w-fit min-w-0">
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
            <div className="min-w-0">{cacheTimeoutField}</div>
          )}
          {unavailableMessage && (
            <div className="sm:col-span-2">{unavailableMessage}</div>
          )}
        </div>
      </div>
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

  return (
    <FormCardGrid testId="endpoint-kv-cache-section" variant="section">
      <div className="col-span-4">{content}</div>
    </FormCardGrid>
  );
}
