import { useList } from "@refinedev/core";
import { useMemo, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/foundation/lib/utils";
import FormCardGrid from "@/foundation/scene/FormCardGrid";
import { FormFieldGroup } from "@/foundation/scene/FormFieldGroup";
import {
  type CacheEndpointCandidate,
  cacheEndpointRefs,
} from "../lib/cache-endpoints";
import {
  registerZCacheTargetNodes,
  setZCacheEnabled,
  setZCacheTargetNode,
  zcacheDraft,
  zcacheTargetNodesInvalid,
} from "../lib/zcache-form";
import { readyNodeCount, zcacheNodeChoices } from "../lib/zcache-nodes";
import {
  cacheFailed,
  cacheMessage,
  isValidCacheCapacity,
  MAX_CACHE_CAPACITY_GIB,
} from "../lib/zcache-presentation";
import type { ClusterCacheStatus, ZCacheStatus } from "../types";
import { CacheEndpointLinks } from "./CacheEndpointLinks";

// Label and dot colour of each node runtime state.
const RUNTIME_VIEW = {
  ready: ["clusters.zcache.ready", "bg-[var(--nt-fill-positive-base)]"],
  notReady: ["clusters.zcache.notReady", "bg-[var(--nt-fill-notice-base)]"],
  eligible: [
    "clusters.zcache.eligibleNode",
    "bg-[var(--nt-text-neutral-quaternary)]",
  ],
  unavailable: [
    "clusters.zcache.unavailableNode",
    "bg-[var(--nt-fill-notice-base)]",
  ],
} as const;

function CacheStatusBadge({
  phase,
}: {
  phase: ClusterCacheStatus["phase"] | undefined;
}) {
  const { t } = useTranslation();
  if (!phase) return null;

  const meta =
    phase === "Ready"
      ? {
          label: t("clusters.zcache.applied"),
          className:
            "border-[var(--nt-stroke-positive-light)] bg-[var(--nt-fill-positive-light)] text-[var(--nt-text-colorful-positive)]",
        }
      : phase === "Reconciling"
        ? {
            label: t("clusters.zcache.reconciling"),
            className:
              "border-primary/20 bg-primary/10 text-[var(--nt-text-colorful-outstanding)]",
          }
        : phase === "Failed"
          ? {
              label: t("clusters.zcache.failed"),
              className:
                "border-[var(--nt-stroke-serious-light)] bg-[var(--nt-fill-serious-light)] text-[var(--nt-text-colorful-serious)]",
            }
          : phase === "Unavailable"
            ? {
                label: t("clusters.zcache.unavailable"),
                className:
                  "border-[var(--nt-stroke-serious-light)] bg-[var(--nt-fill-serious-light)] text-[var(--nt-text-colorful-serious)]",
              }
            : {
                label: t("clusters.zcache.disabled"),
                className:
                  "border-[var(--nt-stroke-neutral-trans-2)] bg-[var(--nt-fill-neutral-opaque-1)] text-[var(--nt-text-neutral-secondary)]",
              };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        meta.className,
      )}
    >
      {meta.label}
    </span>
  );
}

function CacheRuntimeStatus({
  row,
}: {
  row: ReturnType<typeof zcacheNodeChoices>[number];
}) {
  const { t } = useTranslation();
  const [labelKey, dot] = RUNTIME_VIEW[row.runtime];
  const label = t(labelKey);
  const reason = row.reasonKey
    ? t(row.reasonKey)
    : cacheMessage(row.reason, t("clusters.zcache.serviceName"));

  const content = (
    <>
      <span className={cn("size-1.5 shrink-0 rounded-full", dot)} />
      <span
        className={cn(
          "whitespace-nowrap text-xs text-[var(--nt-text-neutral-secondary)]",
          reason &&
            "underline decoration-dashed decoration-[var(--nt-text-neutral-quaternary)] underline-offset-[3px]",
        )}
      >
        {label}
      </span>
    </>
  );

  if (!reason) {
    return <span className="inline-flex items-center gap-1.5">{content}</span>;
  }

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/15"
          >
            {content}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" align="start" className="max-w-xs leading-5">
          {reason}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function ZCacheFields({
  form,
  isEdit,
  status,
  summary,
  compact = false,
}: {
  form: UseFormReturn;
  status?: ZCacheStatus;
  summary?: ClusterCacheStatus;
  compact?: boolean;
  isEdit: boolean;
}) {
  const { t } = useTranslation();
  const name = form.watch("metadata.name");
  const workspace = form.watch("metadata.workspace");
  const options = form.watch("spec.cache.options");
  const { enabled, selected, capacity, totalGiB } = zcacheDraft(options);
  const saved = zcacheDraft(form.formState.defaultValues?.spec?.cache?.options);
  const dependencies = useList<CacheEndpointCandidate>({
    resource: "endpoints",
    pagination: { mode: "off" },
    filters: [{ field: "spec->>cluster", operator: "eq", value: name }],
    meta: {
      workspace,
      workspaced: true,
      select: "id,metadata,status",
    },
    queryOptions: {
      enabled: isEdit && !!name && !!workspace && (enabled || saved.enabled),
      refetchInterval: 5000,
    },
  });
  const dependentEndpoints = useMemo(
    () => cacheEndpointRefs(dependencies.data?.data ?? [], workspace),
    [dependencies.data?.data, workspace],
  );
  const inUse = dependentEndpoints.length > 0;
  const guardRemoval = inUse || dependencies.isLoading || dependencies.isError;
  const rows = zcacheNodeChoices(status, {
    selected,
    saved: saved.selected,
    guardRemoval,
  });
  const [nodeQuery, setNodeQuery] = useState("");
  const normalizedQuery = nodeQuery.trim().toLowerCase();
  const visibleRows = normalizedQuery
    ? rows.filter((row) => row.name.toLowerCase().includes(normalizedQuery))
    : rows;
  const observationError = cacheMessage(
    status?.observation_error,
    t("clusters.zcache.serviceName"),
  );

  const switchDescription =
    enabled && inUse
      ? t("clusters.zcache.dependencyBlockedDescription")
      : enabled && dependencies.isError
        ? t("clusters.zcache.dependencyErrorDescription")
        : enabled && dependencies.isLoading
          ? t("clusters.zcache.dependencyCheckingDescription")
          : enabled
            ? t("clusters.zcache.cacheEnabledDescription")
            : t("clusters.zcache.cacheDisabledDescription");

  const fields = (
    <>
      {!isEdit && (
        <p className="col-span-full text-sm text-muted-foreground">
          {t("clusters.zcache.createHint")}
        </p>
      )}
      {cacheFailed(summary) && (
        <p
          role="alert"
          className="col-span-full rounded-md border border-[var(--nt-stroke-serious-light)] bg-[var(--nt-fill-serious-light)] px-3 py-2 text-sm text-[var(--nt-text-colorful-serious)]"
        >
          {t("clusters.zcache.retryHint")}
        </p>
      )}
      {isEdit && (
        <>
          <div className="col-span-full rounded-md border border-[var(--nt-stroke-neutral-trans-2)] bg-[var(--nt-fill-neutral-opaque-1)] px-4 py-3">
            <div className="flex items-start gap-3">
              <Switch
                checked={enabled}
                disabled={enabled && guardRemoval}
                aria-label={t("clusters.zcache.enable")}
                onCheckedChange={(value) => setZCacheEnabled(form, value)}
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--nt-text-neutral-super)]">
                  {t("clusters.zcache.enable")}
                </p>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                  {switchDescription}
                </p>
              </div>
            </div>
            {saved.enabled && !enabled && (
              <p className="mt-2 border-t border-[var(--nt-stroke-serious-light)] pt-2 text-xs text-[var(--nt-text-colorful-serious)]">
                {t("clusters.zcache.disablePendingHint")}
              </p>
            )}
          </div>
          {enabled && (
            <>
              <FormFieldGroup
                {...form}
                name="spec.cache.options.l1_size_gib"
                label={t("clusters.zcache.capacity")}
                labelAccessory={
                  <span className="rounded bg-[var(--nt-fill-neutral-opaque-1)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("clusters.zcache.capacityUnit")}
                  </span>
                }
                description={t("clusters.zcache.capacityHelp")}
                className="sm:col-span-2"
                rules={{
                  validate: (value) =>
                    isValidCacheCapacity(value) ||
                    t("clusters.zcache.invalidCapacity"),
                }}
              >
                <Input
                  type="number"
                  min={1}
                  max={MAX_CACHE_CAPACITY_GIB}
                  step={1}
                  onChange={(event) =>
                    form.setValue(
                      "spec.cache.options.l1_size_gib",
                      event.target.value === ""
                        ? ""
                        : Number(event.target.value),
                      { shouldDirty: true, shouldValidate: true },
                    )
                  }
                />
              </FormFieldGroup>
              <div className="sm:col-span-2">
                <p className="mb-2 text-sm font-normal leading-[22px] text-[var(--nt-text-neutral-secondary)]">
                  {t("clusters.zcache.configuredTotal")}
                </p>
                <div className="flex h-9 items-center justify-between gap-3 rounded-[var(--nt-radius-input)] border border-[var(--nt-stroke-neutral-trans-2)] bg-[var(--nt-fill-neutral-opaque-1)] px-3">
                  <span className="font-mono text-sm font-semibold text-[var(--nt-text-neutral-super)]">
                    {totalGiB == null ? "—" : `${totalGiB} GiB`}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t("clusters.zcache.selectedCapacity", {
                      count: selected.length,
                      size: capacity ?? "—",
                    })}
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                  {t("clusters.zcache.capacityImpact")}
                </p>
              </div>
              <div className="col-span-full min-w-0 space-y-3">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">
                      {t("clusters.zcache.targetNodes")}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t("clusters.zcache.selectedNodes", {
                        count: selected.length,
                      })}
                      {" · "}
                      {t("clusters.zcache.readyNodes", {
                        count: readyNodeCount(status),
                      })}
                    </p>
                  </div>
                  <Input
                    type="search"
                    className="h-8 w-52"
                    aria-label={t("clusters.zcache.searchNodes")}
                    placeholder={t("clusters.zcache.searchNodes")}
                    value={nodeQuery}
                    onChange={(event) => setNodeQuery(event.target.value)}
                  />
                </div>
                {observationError && (
                  <p role="alert" className="text-sm text-destructive">
                    {t("clusters.zcache.stale")} {observationError}
                  </p>
                )}
                {rows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("clusters.zcache.noCandidates")}
                  </p>
                ) : visibleRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("clusters.zcache.noMatchingNodes")}
                  </p>
                ) : (
                  <Table className="border">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <span className="sr-only">
                            {t("clusters.zcache.selectNode")}
                          </span>
                        </TableHead>
                        <TableHead className="w-[34%]">
                          {t("clusters.zcache.node")}
                        </TableHead>
                        <TableHead className="w-[22%]">
                          {t("clusters.zcache.runtimeShort")}
                        </TableHead>
                        <TableHead className="w-[18%]">
                          {t("clusters.zcache.capacityShort")}
                        </TableHead>
                        <TableHead className="w-[26%]">
                          {t("clusters.zcache.usedBy")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleRows.map((row) => (
                        <TableRow key={row.name} className="h-10">
                          <TableCell className="py-2">
                            <Checkbox
                              aria-label={row.name}
                              checked={row.selected}
                              disabled={row.locked}
                              onCheckedChange={(checked) =>
                                setZCacheTargetNode(
                                  form,
                                  selected,
                                  row.name,
                                  checked === true,
                                )
                              }
                            />
                          </TableCell>
                          <TableCell className="py-2">
                            <span className="whitespace-nowrap font-mono text-xs font-semibold text-[var(--nt-text-neutral-super)]">
                              {row.name}
                            </span>
                          </TableCell>
                          <TableCell className="py-2">
                            <CacheRuntimeStatus row={row} />
                          </TableCell>
                          <TableCell className="py-2 font-mono text-xs">
                            {row.capacityGiB ? `${row.capacityGiB} GiB` : "—"}
                          </TableCell>
                          <TableCell className="py-2">
                            {row.applied && (inUse || dependencies.isError) ? (
                              <CacheEndpointLinks
                                endpoints={dependentEndpoints}
                                error={dependencies.isError}
                              />
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                <input
                  type="hidden"
                  {...registerZCacheTargetNodes(
                    form,
                    t("clusters.zcache.selectNodes"),
                  )}
                />
                {zcacheTargetNodesInvalid(form) && (
                  <p role="alert" className="text-sm text-destructive">
                    {t("clusters.zcache.selectNodes")}
                  </p>
                )}
              </div>
            </>
          )}
        </>
      )}
    </>
  );

  if (compact) {
    return <div className="min-w-0 space-y-4">{fields}</div>;
  }

  return (
    <FormCardGrid
      title={
        <span className="inline-flex items-center gap-2">
          {t("clusters.cache.title")}
          <CacheStatusBadge phase={summary?.phase} />
        </span>
      }
      variant="section"
    >
      {fields}
    </FormCardGrid>
  );
}
