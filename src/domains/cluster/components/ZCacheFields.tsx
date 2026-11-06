import { useList } from "@refinedev/core";
import { useMemo, useState } from "react";
import { type UseFormReturn, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Checkbox } from "@/components/ui/checkbox";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
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
import FormCardGrid from "@/foundation/components/FormCardGrid";
import { FormFieldGroup } from "@/foundation/components/FormFieldGroup";
import { formatToDecimal } from "@/foundation/lib/unit";
import { cn } from "@/foundation/lib/utils";
import {
  CACHE_DEPENDENT_SELECT,
  type CacheDependentEndpoint,
  cacheDependents,
  cacheRemovalBlocked,
  nodeSelectionState,
} from "../lib/zcache-node-selection";
import {
  cacheMessage,
  isValidCacheCapacity,
  MAX_CACHE_CAPACITY_GIB,
  resolveZCacheState,
} from "../lib/zcache-presentation";
import {
  type ClusterCacheStatus,
  type ZCacheSpec,
  type ZCacheStatus,
  zcacheSpec,
} from "../types";

const CONTROL_PLANE_REASON =
  "control-plane nodes are not used for the ZCache runtime by default";

const PHASE_BADGE_CLASS: Record<ClusterCacheStatus["phase"], string> = {
  Ready:
    "border-[var(--nt-stroke-positive-light)] bg-[var(--nt-fill-positive-light)] text-[var(--nt-text-colorful-positive)]",
  Reconciling:
    "border-primary/20 bg-primary/10 text-[var(--nt-text-colorful-outstanding)]",
  Failed:
    "border-[var(--nt-stroke-serious-light)] bg-[var(--nt-fill-serious-light)] text-[var(--nt-text-colorful-serious)]",
  Unavailable:
    "border-[var(--nt-stroke-serious-light)] bg-[var(--nt-fill-serious-light)] text-[var(--nt-text-colorful-serious)]",
  Disabled:
    "border-[var(--nt-stroke-neutral-trans-2)] bg-[var(--nt-fill-neutral-opaque-1)] text-[var(--nt-text-neutral-secondary)]",
};

function CacheStatusBadge({
  desired,
  status,
  summary,
}: {
  desired?: ZCacheSpec;
  status?: ZCacheStatus;
  summary?: ClusterCacheStatus;
}) {
  const { t } = useTranslation();
  if (!summary?.phase) return null;

  const { phase, resultLabelKey } = resolveZCacheState({
    desired,
    status,
    summary,
  });

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        PHASE_BADGE_CLASS[phase],
      )}
    >
      {t(resultLabelKey)}
    </span>
  );
}

function CacheRuntimeStatus({
  node,
  candidate,
}: {
  node?: NonNullable<ZCacheStatus["nodes"]>[number];
  candidate?: NonNullable<ZCacheStatus["candidates"]>[number];
}) {
  const { t } = useTranslation();
  const ready = node?.runtime === "Ready";
  const label = node
    ? t(ready ? "clusters.zcache.ready" : "clusters.zcache.notReady")
    : candidate?.selectable
      ? t("clusters.zcache.eligibleNode")
      : t("clusters.zcache.unavailableNode");
  const reason = node?.reason
    ? cacheMessage(node.reason, t("clusters.zcache.serviceName"))
    : candidate?.reason === CONTROL_PLANE_REASON
      ? t("clusters.zcache.kubernetesControlPlane")
      : candidate?.reason
        ? cacheMessage(candidate.reason, t("clusters.zcache.serviceName"))
        : undefined;

  const content = (
    <>
      <span
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          node
            ? ready
              ? "bg-[var(--nt-fill-positive-base)]"
              : "bg-[var(--nt-fill-notice-base)]"
            : candidate?.selectable
              ? "bg-[var(--nt-text-neutral-quaternary)]"
              : "bg-[var(--nt-fill-notice-base)]",
        )}
      />
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

function CacheDependencyCell({
  endpoints,
  error,
}: {
  endpoints: string[];
  error: boolean;
}) {
  const { t } = useTranslation();

  if (!error && endpoints.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <HoverCard openDelay={120} closeDelay={120}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className="text-left text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/15"
        >
          {error
            ? t("clusters.zcache.dependencyCheckFailed")
            : t("clusters.zcache.dependencyCount", {
                count: endpoints.length,
              })}
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="start"
        className="w-[300px] p-3 text-xs leading-5"
      >
        <div className="font-semibold">
          {error
            ? t("clusters.zcache.dependencyCheckFailedTitle")
            : t("clusters.zcache.dependencyCardTitle", {
                count: endpoints.length,
              })}
        </div>
        {!error && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {endpoints.map((endpoint) => (
              <span
                key={endpoint}
                className="rounded border border-[var(--nt-stroke-neutral-trans-2)] bg-[var(--nt-fill-neutral-white)] px-1.5 py-0.5 font-mono text-[11px]"
              >
                {endpoint}
              </span>
            ))}
          </div>
        )}
        <p className="mt-2 text-muted-foreground">
          {error
            ? t("clusters.zcache.dependencyCheckFailedHint")
            : t("clusters.zcache.dependencyInstruction")}
        </p>
      </HoverCardContent>
    </HoverCard>
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
  // useWatch, unlike form.watch, also re-renders when the whole options
  // object is replaced (see setCacheEnabled).
  const enabled =
    useWatch({ control: form.control, name: "spec.cache.options.enabled" }) ===
    true;
  const savedEnabled =
    form.formState.defaultValues?.spec?.cache?.options?.enabled === true;
  const dependencies = useList<CacheDependentEndpoint>({
    resource: "endpoints",
    pagination: { mode: "off" },
    filters: [{ field: "spec->>cluster", operator: "eq", value: name }],
    meta: {
      workspace,
      workspaced: true,
      select: CACHE_DEPENDENT_SELECT,
    },
    queryOptions: {
      enabled: isEdit && !!name && !!workspace && (enabled || savedEnabled),
      refetchInterval: 5000,
    },
  });
  const dependentEndpoints = useMemo(
    () => cacheDependents(dependencies.data?.data ?? []),
    [dependencies.data?.data],
  );
  const inUse = dependentEndpoints.length > 0;
  const dependencyCheck = {
    inUse,
    loading: dependencies.isLoading,
    error: dependencies.isError,
  };
  const guardRemoval = cacheRemovalBlocked(dependencyCheck);
  const appliedNodes: string[] =
    status?.current?.target_nodes ??
    form.formState.defaultValues?.spec?.cache?.options?.target_nodes ??
    [];
  const selected: string[] =
    form.watch("spec.cache.options.target_nodes") ?? [];
  const candidates = status?.candidates ?? [];
  const names = [
    ...new Set([...candidates.map((node) => node.name), ...selected]),
  ];
  const nodes = status?.nodes ?? [];
  const readyCount = nodes.filter((node) => node.runtime === "Ready").length;
  const [nodeQuery, setNodeQuery] = useState("");
  const normalizedQuery = nodeQuery.trim().toLowerCase();
  const visibleNames = normalizedQuery
    ? names.filter((nodeName) =>
        nodeName.toLowerCase().includes(normalizedQuery),
      )
    : names;
  const capacity = form.watch("spec.cache.options.l1_size_gib");
  const capacityNumber = Number(capacity);
  const capacityIsValid = isValidCacheCapacity(capacity);
  const totalCapacity = capacityIsValid
    ? capacityNumber * selected.length
    : null;

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

  const setCacheEnabled = (value: boolean) => {
    form.setValue("spec.cache.provider", "zcache", {
      shouldDirty: true,
    });
    form.setValue(
      "spec.cache.options",
      {
        ...form.getValues("spec.cache.options"),
        enabled: value,
        l1_size_gib: capacityIsValid ? capacityNumber : 1,
        target_nodes: selected,
      },
      { shouldDirty: true, shouldValidate: true },
    );
  };

  const fields = (
    <>
      {!isEdit && (
        <p className="col-span-full text-sm text-muted-foreground">
          {t("clusters.zcache.createHint")}
        </p>
      )}
      {summary?.phase === "Failed" && (
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
                onCheckedChange={setCacheEnabled}
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
            {savedEnabled && !enabled && (
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
                    {totalCapacity == null ? "—" : `${totalCapacity} GiB`}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t("clusters.zcache.selectedCapacity", {
                      count: selected.length,
                      size: capacityIsValid ? capacityNumber : "—",
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
                        count: readyCount,
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
                {status?.observation_error && (
                  <p role="alert" className="text-sm text-destructive">
                    {t("clusters.zcache.stale")}{" "}
                    {cacheMessage(
                      status.observation_error,
                      t("clusters.zcache.serviceName"),
                    )}
                  </p>
                )}
                {names.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("clusters.zcache.noCandidates")}
                  </p>
                ) : visibleNames.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("clusters.zcache.noMatchingNodes")}
                  </p>
                ) : (
                  <div className="rounded-md border">
                    <Table>
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
                        {visibleNames.map((nodeName) => {
                          const candidate = candidates.find(
                            (node) => node.name === nodeName,
                          );
                          const node = nodes.find(
                            (node) => node.name === nodeName,
                          );
                          const selection = nodeSelectionState({
                            nodeName,
                            selected,
                            applied: appliedNodes,
                            selectable: candidate?.selectable === true,
                            inventoryStale: !!status?.observation_error,
                            dependencies: dependencyCheck,
                          });
                          const capacityGiB =
                            node && node.capacity_bytes > 0
                              ? formatToDecimal(
                                  node.capacity_bytes / 2 ** 30,
                                  0,
                                )
                              : null;
                          return (
                            <TableRow key={nodeName} className="h-10">
                              <TableCell className="py-2">
                                <Checkbox
                                  aria-label={nodeName}
                                  checked={selection.selected}
                                  disabled={selection.disabled}
                                  onCheckedChange={(checked) =>
                                    form.setValue(
                                      "spec.cache.options.target_nodes",
                                      checked === true
                                        ? [...selected, nodeName]
                                        : selected.filter(
                                            (name) => name !== nodeName,
                                          ),
                                      {
                                        shouldDirty: true,
                                        shouldValidate: true,
                                      },
                                    )
                                  }
                                />
                              </TableCell>
                              <TableCell className="py-2">
                                <span className="whitespace-nowrap font-mono text-xs font-semibold text-[var(--nt-text-neutral-super)]">
                                  {nodeName}
                                </span>
                              </TableCell>
                              <TableCell className="py-2">
                                <CacheRuntimeStatus
                                  node={node}
                                  candidate={candidate}
                                />
                              </TableCell>
                              <TableCell className="py-2 font-mono text-xs">
                                {capacityGiB ? `${capacityGiB} GiB` : "—"}
                              </TableCell>
                              <TableCell className="py-2">
                                {selection.showDependents ? (
                                  <CacheDependencyCell
                                    endpoints={dependentEndpoints}
                                    error={dependencies.isError}
                                  />
                                ) : (
                                  <span className="text-muted-foreground">
                                    —
                                  </span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
                <input
                  type="hidden"
                  {...form.register("spec.cache.options.target_nodes", {
                    validate: (value) =>
                      form.getValues("spec.cache.options.enabled") !== true ||
                      (value?.length ?? 0) > 0 ||
                      t("clusters.zcache.selectNodes"),
                  })}
                />
                {form.getFieldState(
                  "spec.cache.options.target_nodes",
                  form.formState,
                ).error && (
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
    return <div className="space-y-4">{fields}</div>;
  }

  return (
    <FormCardGrid
      title={
        <span className="inline-flex items-center gap-2">
          {t("clusters.cache.title")}
          <CacheStatusBadge
            desired={zcacheSpec({
              spec: { cache: form.formState.defaultValues?.spec?.cache },
            })}
            status={status}
            summary={summary}
          />
        </span>
      }
      variant="section"
    >
      {fields}
    </FormCardGrid>
  );
}
