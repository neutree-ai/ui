import { Layers, Server } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  type EndpointReplicaNodeResourceGroup,
  type EndpointReplicaResourceGroup,
  getEndpointReplicaResourceGroups,
  getEndpointResourceSummaryRows,
} from "@/domains/endpoint/lib/resource-status";
import { getVgpuVirtualization } from "@/domains/endpoint/lib/vgpu";
import { EmptyValue } from "@/foundation/components/EmptyValue";
import {
  GpuObservationCard,
  GpuObservationTableHeader,
} from "@/foundation/components/GpuObservationCard";
import {
  type AcceleratorSample,
  formatL1CacheUsage,
  type GpuAllocation,
  type NodeL1CacheUsage,
  reading,
} from "@/foundation/lib/accelerator-observations";
import { productPeakTflops } from "@/foundation/lib/accelerator-tflops";
import { formatMiBAsGiB, formatToDecimal } from "@/foundation/lib/unit";
import { cn } from "@/foundation/lib/utils";
import type {
  ClusterResourceInfo,
  EndpointResourceStatus,
} from "@/foundation/types/resource-types";
import type { ResourceSpec } from "@/foundation/types/serving-types";
import type { EndpointReplicaResourceRow } from "../lib/resource-status";

type EndpointRuntimeResourcesCardProps = {
  resources: EndpointResourceStatus | null | undefined;
  requestedResources?: ResourceSpec | null;
  clusterResourceInfo?: ClusterResourceInfo | null;
  className?: string;
  l1CacheByNode?: Record<string, NodeL1CacheUsage>;
  samples?: AcceleratorSample[];
  observationStatus?: string;
  onObservationRetry?: () => void;
  tflopsOverrides?: Record<string, number>;
  endpointName?: string;
  workspace?: string;
  modelName?: string;
};

const formatInteger = (value: number): ReactNode =>
  formatToDecimal(value, 0) ?? <EmptyValue />;

const formatCoreLimit = (value: number): ReactNode =>
  value > 0 ? formatInteger(value) : <EmptyValue />;

const formatMemoryGiB = (value: number): ReactNode =>
  formatMiBAsGiB(value) ?? <EmptyValue />;

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

const allocationForDevice = (
  device: EndpointReplicaResourceRow,
  identity: { endpointName: string; workspace: string; modelName: string },
): GpuAllocation => ({
  endpoint: identity.endpointName,
  workspace: identity.workspace,
  model: identity.modelName,
  node: device.nodeId,
  uuid: device.uuid,
  replica: device.replicaId,
  instance: device.instanceId,
  vdevice: device.vdeviceIndex ?? undefined,
  memoryMiB: device.memoryMiB,
  modelWeightsMiB: device.modelWeightsMiB,
  kvCacheCapacityMiB: device.kvCacheCapacityMiB,
});

const measuredTotal = (values: Array<number | null>): number | null =>
  values.length > 0 && values.every((value) => value != null)
    ? values.reduce<number>((sum, value) => sum + Number(value), 0)
    : null;

type ObservationHandles = { status?: string; refetch?: () => void };

function ReplicaSummary({
  group,
  samples,
  identity,
  observations,
}: {
  group: EndpointReplicaResourceGroup;
  samples: AcceleratorSample[];
  identity: { endpointName: string; workspace: string; modelName: string };
  observations?: ObservationHandles;
}) {
  const { t } = useTranslation();
  const devices = group.nodes.flatMap((node) => node.devices);
  const measurements = devices.map((device) => {
    const allocation = allocationForDevice(device, identity);
    return reading(
      samples,
      "neutree_endpoint_replica_accelerator_memory_used_bytes",
      device.nodeId,
      device.uuid,
      allocation,
    );
  });
  const utilizations = devices.map((device) => {
    const allocation = allocationForDevice(device, identity);
    return reading(
      samples,
      "neutree_endpoint_replica_accelerator_utilization_ratio",
      device.nodeId,
      device.uuid,
      allocation,
    );
  });
  const actual = measuredTotal(
    measurements.map((sample) => (sample ? sample.value / 1024 ** 2 : null)),
  );
  const utilValues = utilizations.map((sample) => sample?.value ?? null);
  const allUtilizationsKnown =
    utilValues.length > 0 && utilValues.every((value) => value != null);
  const averageUtilization = allUtilizationsKnown
    ? (utilValues.reduce<number>((sum, value) => sum + Number(value), 0) /
        utilValues.length) *
      100
    : null;
  const peakUtilization = allUtilizationsKnown
    ? Math.max(...utilValues.map(Number)) * 100
    : null;
  const l0Cache =
    group.kvCacheCapacityMiB == null
      ? null
      : group.kvCacheCapacityMiB * group.deviceCount;

  return (
    <div className="grid border-b border-[var(--nt-stroke-neutral-trans-2)] bg-[var(--nt-fill-neutral-trans-2)] sm:grid-cols-2 xl:grid-cols-4">
      <SummaryCell
        label={t("observations.reservedVram")}
        value={formatMemoryGiB(group.memoryMiB)}
      />
      <SummaryCell
        label={t("observations.vramInUse")}
        value={
          actual == null
            ? "—"
            : `${formatMemoryGiB(actual)} / ${formatMemoryGiB(group.memoryMiB)}`
        }
      />
      <SummaryCell
        label={t("observations.utilization")}
        value={
          averageUtilization == null ? "—" : `${averageUtilization.toFixed(0)}%`
        }
        detail={
          peakUtilization == null
            ? null
            : t("observations.averagePeak", {
                peak: peakUtilization.toFixed(0),
              })
        }
      />
      <SummaryCell
        label={t("observations.l0KvCache")}
        value={l0Cache == null ? "—" : formatMemoryGiB(l0Cache)}
        detail={t("observations.acrossGpus", { count: group.deviceCount })}
      />
    </div>
  );
}

function SummaryCell({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode | null;
}) {
  return (
    <div className="min-w-0 border-b border-r border-[var(--nt-stroke-neutral-trans-2)] px-3.5 py-2.5 last:border-r-0 sm:border-b-0">
      <div className="text-[11px] leading-4 text-muted-foreground">{label}</div>
      <div className="mt-0.5 flex min-w-0 items-baseline gap-1.5">
        <strong className="truncate text-sm font-semibold leading-5 tabular-nums">
          {value}
        </strong>
        {detail && (
          <span className="truncate text-[11px] leading-4 text-muted-foreground">
            {detail}
          </span>
        )}
      </div>
    </div>
  );
}

function NodeSummary({
  node,
  l1Cache,
  requestedCpu,
  requestedMemory,
  t,
}: {
  node: EndpointReplicaNodeResourceGroup;
  l1Cache?: NodeL1CacheUsage;
  requestedCpu: ReactNode;
  requestedMemory: ReactNode;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 border-b border-[var(--nt-stroke-neutral-trans-2)] bg-[var(--nt-fill-neutral-trans-2)] px-4 py-2.5">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-[var(--nt-stroke-neutral-trans-2)] text-muted-foreground">
        <Server aria-hidden="true" className="h-3.5 w-3.5" />
      </span>
      <span
        className="min-w-0 truncate text-sm font-semibold leading-5"
        title={node.nodeId}
      >
        {node.nodeId || <EmptyValue />}
      </span>
      <span className="ml-auto text-[11px] leading-4 text-muted-foreground">
        {t("common.fields.cpu")} {requestedCpu} · {t("common.fields.memory")}{" "}
        {requestedMemory} GiB
        {l1Cache && (
          <>
            {" · "}
            {t("observations.l1KvCache")} {formatL1CacheUsage(l1Cache)}
          </>
        )}{" "}
        ·{" "}
        {formatCount(
          node.deviceCount,
          "endpoints.fields.card",
          "endpoints.fields.cards",
          t,
        )}
      </span>
    </div>
  );
}

function Replica({
  group,
  groupIndex,
  samples,
  requestedCpu,
  requestedMemory,
  clusterResourceInfo,
  l1CacheByNode,
  tflopsOverrides,
  identity,
  requestedCorePerCard,
  observations,
}: {
  group: EndpointReplicaResourceGroup;
  groupIndex: number;
  samples: AcceleratorSample[];
  requestedCpu: ReactNode;
  requestedMemory: ReactNode;
  clusterResourceInfo?: ClusterResourceInfo | null;
  l1CacheByNode?: Record<string, NodeL1CacheUsage>;
  tflopsOverrides: Record<string, number>;
  identity: { endpointName: string; workspace: string; modelName: string };
  requestedCorePerCard?: number;
  observations?: ObservationHandles;
}) {
  const { t } = useTranslation();
  const replicaName = group.replicaId || group.instanceId;

  return (
    <section
      data-testid="runtime-replica"
      className="min-w-0 overflow-hidden rounded-md border border-[var(--nt-stroke-neutral-trans-2)] bg-[var(--nt-fill-neutral-opaque-1)]"
    >
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-[var(--nt-stroke-neutral-trans-2)] px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-[var(--nt-stroke-neutral-trans-2)] text-muted-foreground">
            <Layers aria-hidden="true" className="h-4 w-4" />
          </span>
          <div className="grid min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 text-xs leading-4 text-muted-foreground">
              <span>
                {t("common.fields.replica")} {groupIndex}
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
              className="min-w-0 truncate font-mono text-xs leading-4 text-muted-foreground"
              title={replicaName || undefined}
            >
              {replicaName || <EmptyValue />}
            </span>
          </div>
        </div>
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {formatCount(
            group.deviceCount,
            "endpoints.fields.card",
            "endpoints.fields.cards",
            t,
          )}
          {" · "}
          {formatMemoryGiB(group.memoryMiB)} {t("endpoints.fields.vgpuMemory")}
        </span>
      </div>

      <ReplicaSummary
        group={group}
        samples={samples}
        identity={identity}
        observations={observations}
      />

      <div className="overflow-x-auto">
        <div role="table">
          <GpuObservationTableHeader variant="allocation" />
          {group.nodes.map((node) => (
            <div key={node.nodeId}>
              <NodeSummary
                node={node}
                l1Cache={l1CacheByNode?.[node.nodeId]}
                requestedCpu={requestedCpu}
                requestedMemory={requestedMemory}
                t={t}
              />
              {node.devices.map((device, deviceIndex) => {
                const allocation: GpuAllocation = {
                  ...allocationForDevice(device, identity),
                };
                return (
                  <GpuObservationCard
                    key={`${device.uuid}:${device.vdeviceIndex ?? deviceIndex}`}
                    variant="allocation"
                    device={{
                      node: device.nodeId,
                      uuid: device.uuid,
                      index: device.order ?? deviceIndex + 1,
                      product: device.product,
                      totalMiB: device.physicalMemoryMiB,
                      allocatedMiB: device.memoryMiB,
                      coreUnits:
                        device.coreUnits > 0
                          ? device.coreUnits
                          : requestedCorePerCard,
                      peakFP16TFLOPS: productPeakTflops(
                        clusterResourceInfo,
                        device.product,
                      ),
                    }}
                    samples={samples}
                    allocations={[allocation]}
                    replica={allocation}
                    tflopsOverrides={tflopsOverrides}
                    observationStatus={observations?.status}
                    onRetry={observations?.refetch}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function EndpointRuntimeResourcesCard({
  resources,
  requestedResources,
  clusterResourceInfo,
  className,
  l1CacheByNode,
  samples = [],
  tflopsOverrides = {},
  endpointName = "",
  workspace = "default",
  modelName = "",
  observationStatus,
  onObservationRetry,
}: EndpointRuntimeResourcesCardProps) {
  const { t } = useTranslation();
  const requestedCpu = formatToDecimal(requestedResources?.cpu) ?? (
    <EmptyValue />
  );
  const requestedMemory = formatToDecimal(requestedResources?.memory) ?? (
    <EmptyValue />
  );
  const acceleratorResourceType = requestedResources?.accelerator?.type;
  const requestedCorePerCard =
    getVgpuVirtualization(requestedResources?.accelerator)?.core_percent ??
    undefined;
  const summaryRows = getEndpointResourceSummaryRows(resources);
  const replicaGroups = getEndpointReplicaResourceGroups(resources, {
    clusterResourceInfo,
    acceleratorType: acceleratorResourceType,
  });
  const identity = { endpointName, workspace, modelName };

  if (summaryRows.length === 0 && replicaGroups.length === 0) {
    return null;
  }

  return (
    <TooltipProvider>
      <div className={cn("space-y-3", className)}>
        {replicaGroups.map((group, groupIndex) => (
          <Replica
            key={`${group.instanceId}:${group.replicaId}:${groupIndex}`}
            group={group}
            groupIndex={groupIndex}
            samples={samples}
            requestedCpu={requestedCpu}
            requestedMemory={requestedMemory}
            clusterResourceInfo={clusterResourceInfo}
            l1CacheByNode={l1CacheByNode}
            tflopsOverrides={tflopsOverrides}
            identity={identity}
            requestedCorePerCard={requestedCorePerCard}
            observations={{
              status: observationStatus,
              refetch: onObservationRetry,
            }}
          />
        ))}

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
                    {row.product || <EmptyValue />}
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
