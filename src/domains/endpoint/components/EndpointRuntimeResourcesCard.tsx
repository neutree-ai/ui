import { Copy, Layers, Server } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  type EndpointReplicaNodeResourceGroup,
  type EndpointReplicaResourceGroup,
  getEndpointReplicaResourceGroups,
  getEndpointResourceSummaryRows,
} from "@/domains/endpoint/lib/resource-status";
import { getVgpuVirtualization } from "@/domains/endpoint/lib/vgpu";
import { MetricBar } from "@/foundation/components/MetricBar";
import { ResourceUsageLegend } from "@/foundation/components/ResourceUsageLegend";
import { useCopyToClipboard } from "@/foundation/hooks/use-copy-to-clipboard";
import {
  GPU_CELL_CLASS,
  GPU_USAGE_TEXT_CLASS,
  getGpuCellGridStyle,
} from "@/foundation/lib/gpu-device-resources";
import {
  formatMiBAsGiB,
  formatMiBAsGiBValue,
  formatToDecimal,
} from "@/foundation/lib/unit";
import { cn } from "@/foundation/lib/utils";
import type { EndpointResourceStatus } from "@/foundation/types/resource-types";
import type { ResourceSpec } from "@/foundation/types/serving-types";

type EndpointRuntimeResourcesCardProps = {
  resources: EndpointResourceStatus | null | undefined;
  requestedResources?: ResourceSpec | null;
  className?: string;
};

const formatInteger = (value: number) => formatToDecimal(value, 0) ?? "-";

const formatCoreLimit = (value: number) =>
  value > 0 ? formatInteger(value) : "-";

const formatMemoryGiB = (value: number) => formatMiBAsGiB(value) ?? "-";

const formatVramValue = (value: number | null) => {
  if (value == null) return "—";
  const formatted = formatMiBAsGiBValue(value);
  return formatted == null ? "—" : formatted.replace(/\.0$/, "");
};

const formatCount = (
  count: number,
  singular: string,
  plural: string,
  t: (key: string, options?: Record<string, unknown>) => string,
) => `${count} ${t(count === 1 ? singular : plural)}`;

const formatAllocatedCardCount = (
  count: number,
  t: (key: string, options?: Record<string, unknown>) => string,
) =>
  `${count} ${t(
    count === 1
      ? "endpoints.fields.allocatedCard"
      : "endpoints.fields.allocatedCards",
  )}`;

const VRAM_BAR_PERCENT_MAX = 100;

const VramBar = ({
  requestedMiB,
  physicalMiB,
}: {
  requestedMiB: number;
  physicalMiB: number | null;
}) => {
  const hasScale = physicalMiB != null && physicalMiB > 0;
  const requestedPercent = hasScale
    ? Math.min(
        VRAM_BAR_PERCENT_MAX,
        Math.max(0, (requestedMiB / physicalMiB) * VRAM_BAR_PERCENT_MAX),
      )
    : 0;

  return (
    <div className="min-w-0">
      <MetricBar
        data-testid="runtime-vram-bar"
        value={requestedPercent}
        series="neutral"
        track={hasScale ? "outlined" : "unavailable"}
      />
      {/* Restore a requested-VRAM boundary marker here when the bar once again
          includes a separate real-time actual-usage fill. */}
      <div
        data-testid="runtime-vram-values"
        className={cn(
          "mt-1 flex items-center gap-1 whitespace-nowrap tabular-nums text-muted-foreground",
          GPU_USAGE_TEXT_CLASS,
        )}
      >
        <span className="font-semibold text-[var(--nt-text-neutral-super)]">
          {formatVramValue(requestedMiB)}
        </span>
        <span>/</span>
        <span>{formatVramValue(physicalMiB)}</span>
        <span>GiB</span>
      </div>
    </div>
  );
};

const Legend = ({
  t,
}: {
  t: (key: string, options?: Record<string, unknown>) => string;
}) => (
  <ResourceUsageLegend
    className="ml-0 text-[11px] leading-4"
    items={[
      {
        label: t("endpoints.fields.requestedMemory"),
        markerClassName:
          "h-2 w-2 rounded-sm bg-[var(--nt-fill-neutral-trans-7)] dark:bg-[var(--nt-fill-neutral-trans-5)]",
      },
      {
        label: t("endpoints.fields.physicalMemory"),
        markerClassName:
          "h-2 w-2 rounded-sm border border-[var(--nt-stroke-neutral-trans-3)] bg-[var(--nt-fill-neutral-opaque-2)]",
      },
    ]}
  />
);

export function EndpointRuntimeResourcesSummary({
  resources,
  className,
}: {
  resources: EndpointResourceStatus | null | undefined;
  className?: string;
}) {
  const { t } = useTranslation();
  const replicaGroups = getEndpointReplicaResourceGroups(resources);
  const allocatedDeviceCount = replicaGroups.reduce(
    (sum, group) => sum + group.deviceCount,
    0,
  );

  if (allocatedDeviceCount === 0) {
    return null;
  }

  return (
    <span className={cn("text-xs text-muted-foreground", className)}>
      {formatCount(
        replicaGroups.length,
        "endpoints.fields.replicaUnit",
        "endpoints.fields.replicaUnits",
        t,
      )}{" "}
      / {formatAllocatedCardCount(allocatedDeviceCount, t)}
    </span>
  );
}

export default function EndpointRuntimeResourcesCard({
  resources,
  requestedResources,
  className,
}: EndpointRuntimeResourcesCardProps) {
  const { t } = useTranslation();
  const { copy } = useCopyToClipboard();

  const requestedCpu = formatToDecimal(requestedResources?.cpu) ?? "—";
  const requestedMemory = formatToDecimal(requestedResources?.memory) ?? "—";
  const requestedCorePerCard =
    getVgpuVirtualization(requestedResources?.accelerator)?.core_percent ??
    undefined;
  const acceleratorType = requestedResources?.accelerator?.type
    ? t(`clusters.acceleratorTypes.${requestedResources.accelerator.type}`, {
        defaultValue: requestedResources.accelerator.type,
      })
    : null;

  const summaryRows = getEndpointResourceSummaryRows(resources);
  const replicaGroups = getEndpointReplicaResourceGroups(resources);

  if (summaryRows.length === 0 && replicaGroups.length === 0) {
    return null;
  }

  return (
    <TooltipProvider>
      <div className={cn("space-y-4", className)}>
        {replicaGroups.length > 0 && (
          <div className="divide-y divide-[var(--nt-stroke-neutral-trans-2)] border border-[var(--nt-stroke-neutral-trans-2)]">
            {replicaGroups.map((group, groupIndex) => (
              <Replica
                key={`${group.instanceId}:${group.replicaId}:${groupIndex}`}
                group={group}
                groupIndex={groupIndex}
                requestedCpu={requestedCpu}
                requestedMemory={requestedMemory}
                requestedCorePerCard={requestedCorePerCard}
                acceleratorType={acceleratorType}
                onCopyUuid={copy}
                t={t}
              />
            ))}
          </div>
        )}

        {replicaGroups.length === 0 && summaryRows.length > 0 && (
          <div className="space-y-2" data-testid="runtime-resource-summary">
            {summaryRows.map((row) => (
              <div
                className="grid min-w-0 gap-4 rounded-md border px-3 py-2 md:grid-cols-[minmax(180px,1.2fr)_repeat(2,minmax(120px,1fr))] md:items-center"
                key={row.product}
              >
                <div className="min-w-0">
                  <span className="block text-xs leading-4 text-muted-foreground">
                    {t("common.fields.acceleratorProduct")}
                  </span>
                  <span
                    className="block truncate text-sm font-semibold leading-5"
                    title={row.product}
                  >
                    {row.product || "-"}
                  </span>
                </div>
                <div className="grid gap-1">
                  <span className="text-xs leading-4 text-muted-foreground">
                    {t("clusters.fields.memoryUsage")}
                  </span>
                  <span className="text-sm font-semibold leading-5">
                    {formatMemoryGiB(row.memoryMiB)}
                  </span>
                </div>
                <div className="grid gap-1">
                  <span className="text-xs leading-4 text-muted-foreground">
                    {t("clusters.fields.coreUsage")}
                  </span>
                  <span className="text-sm font-semibold leading-5">
                    {formatCoreLimit(row.coreUnits)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

function Replica({
  group,
  groupIndex,
  requestedCpu,
  requestedMemory,
  requestedCorePerCard,
  acceleratorType,
  onCopyUuid,
  t,
}: {
  group: EndpointReplicaResourceGroup;
  groupIndex: number;
  requestedCpu: string;
  requestedMemory: string;
  requestedCorePerCard: number | undefined;
  acceleratorType: string | null;
  onCopyUuid: ReturnType<typeof useCopyToClipboard>["copy"];
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const replicaName = group.replicaId || group.instanceId || "-";
  const requestedCoreUnits =
    requestedCorePerCard != null
      ? requestedCorePerCard * group.deviceCount
      : group.coreUnits;

  return (
    <section data-testid="runtime-replica" className="min-w-0">
      <div className="sticky top-[-16px] z-10 border-b border-[var(--nt-stroke-neutral-trans-2)] bg-[var(--nt-fill-neutral-opaque-1)] px-4 py-3">
        <div className="flex min-w-0 items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-[var(--nt-stroke-neutral-trans-2)] bg-[var(--nt-fill-neutral-white)] text-muted-foreground">
              <Layers aria-hidden="true" className="h-4 w-4" />
            </span>
            <div className="grid min-w-0 gap-0.5">
              <div className="flex flex-wrap items-center gap-x-2 text-xs leading-4 text-muted-foreground">
                <span>
                  {t("common.fields.replica")} {groupIndex + 1}
                </span>
                {group.nodeCount > 1 && (
                  <>
                    <span>·</span>
                    <span>
                      {t("endpoints.fields.crossNodes", {
                        count: group.nodeCount,
                      })}
                    </span>
                  </>
                )}
              </div>
              <span
                className="min-w-0 truncate text-sm font-semibold leading-5"
                title={replicaName}
              >
                {replicaName}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 whitespace-nowrap text-xs text-muted-foreground">
            <span>
              {formatCount(
                group.deviceCount,
                "endpoints.fields.card",
                "endpoints.fields.cards",
                t,
              )}
            </span>
            <span>·</span>
            <span>
              {formatMemoryGiB(group.memoryMiB)}{" "}
              {t("endpoints.fields.vgpuMemory")}
            </span>
            <span>·</span>
            <span>
              {t("clusters.fields.coreUsage")}{" "}
              {formatCoreLimit(requestedCoreUnits)}
            </span>
          </div>
        </div>
      </div>

      <div className="px-4 pb-4 pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {t("endpoints.sections.gpuAllocation")}
          </span>
          <Legend t={t} />
        </div>
        <div className="mt-3">
          {group.nodes.map((node) => (
            <Host
              key={node.nodeId}
              node={node}
              maxCols={group.maxNodeDeviceCount}
              requestedCpu={requestedCpu}
              requestedMemory={requestedMemory}
              acceleratorType={acceleratorType}
              onCopyUuid={onCopyUuid}
              t={t}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function Host({
  node,
  maxCols,
  requestedCpu,
  requestedMemory,
  acceleratorType,
  onCopyUuid,
  t,
}: {
  node: EndpointReplicaNodeResourceGroup;
  maxCols: number;
  requestedCpu: string;
  requestedMemory: string;
  acceleratorType: string | null;
  onCopyUuid: ReturnType<typeof useCopyToClipboard>["copy"];
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  return (
    <div className="mb-3 last:mb-0">
      <div data-testid="runtime-host" className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-[var(--nt-stroke-neutral-trans-2)] text-muted-foreground">
            <Server aria-hidden="true" className="h-4 w-4" />
          </span>
          <span
            className="min-w-0 truncate text-sm font-semibold leading-5"
            title={node.nodeId}
          >
            {node.nodeId || "-"}
          </span>
          <span className="ml-auto whitespace-nowrap text-xs text-muted-foreground">
            {t("common.fields.cpu")} {requestedCpu} ·{" "}
            {t("common.fields.memory")} {requestedMemory} GiB ·{" "}
            {formatCount(
              node.deviceCount,
              "endpoints.fields.card",
              "endpoints.fields.cards",
              t,
            )}
          </span>
        </div>

        <div className="mt-3 overflow-x-auto pb-1">
          <div
            className="grid divide-x divide-[var(--nt-stroke-neutral-trans-2)] overflow-hidden rounded-md border border-[var(--nt-stroke-neutral-trans-2)]"
            style={getGpuCellGridStyle(maxCols)}
          >
            {node.devices.map((device, deviceIndex) => (
              <GpuCell
                key={device.uuid || deviceIndex}
                device={device}
                deviceIndex={deviceIndex}
                acceleratorType={acceleratorType}
                onCopyUuid={onCopyUuid}
                t={t}
              />
            ))}
            {Array.from({
              length: Math.max(0, maxCols - node.deviceCount),
            }).map((_, emptyIndex) => (
              <div className="min-h-[96px]" key={`empty-${emptyIndex}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function GpuCell({
  device,
  deviceIndex,
  acceleratorType,
  onCopyUuid,
  t,
}: {
  device: EndpointReplicaResourceGroup["nodes"][number]["devices"][number];
  deviceIndex: number;
  acceleratorType: string | null;
  onCopyUuid: ReturnType<typeof useCopyToClipboard>["copy"];
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const gpuNumber = device.order ?? deviceIndex + 1;

  return (
    <div data-testid="runtime-gpu-cell" className={GPU_CELL_CLASS}>
      <div className="flex min-w-0 items-center gap-1">
        <span className="whitespace-nowrap text-sm font-semibold leading-5">
          {t("clusters.fields.gpuNumber")} {gpuNumber}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title={t("clusters.actions.copyUuid")}
          aria-label={`${t("clusters.fields.gpuNumber")} ${gpuNumber} ${t("clusters.actions.copyUuid")}`}
          className="h-6 w-6 shrink-0 text-muted-foreground"
          onClick={() =>
            onCopyUuid(device.uuid, {
              successMessage: t("clusters.messages.copyUuidSuccess"),
              errorMessage: t("clusters.messages.copyUuidFailed"),
            })
          }
        >
          <Copy className="h-3.5 w-3.5" />
          <span className="sr-only">{t("clusters.actions.copyUuid")}</span>
        </Button>
      </div>

      <Tooltip>
        <TooltipTrigger asChild>
          <span
            data-testid="runtime-gpu-product"
            className="mt-1 block min-w-0 truncate text-xs leading-4 text-muted-foreground"
          >
            {acceleratorType && <>{acceleratorType} · </>}
            {device.product || "-"}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {[acceleratorType, device.product].filter(Boolean).join(" · ") || "-"}
        </TooltipContent>
      </Tooltip>

      <div className="mt-2">
        <VramBar
          requestedMiB={device.memoryMiB}
          physicalMiB={device.physicalMemoryMiB}
        />
      </div>

      <div className={cn("mt-1 text-muted-foreground", GPU_USAGE_TEXT_CLASS)}>
        {t("clusters.fields.coreUsage")} {formatCoreLimit(device.coreUnits)}
      </div>
    </div>
  );
}
