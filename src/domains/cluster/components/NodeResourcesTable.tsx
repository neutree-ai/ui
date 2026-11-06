import { ChevronDown, ChevronRight, Server } from "lucide-react";
import { Fragment, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Table as UITable,
} from "@/components/ui/table";
import { EmptyValue } from "@/foundation/components/EmptyValue";
import {
  GpuObservationCard,
  type GpuObservationDisplay,
  GpuObservationTableHeader,
} from "@/foundation/components/GpuObservationCard";
import { MetricBar } from "@/foundation/components/MetricBar";
import type {
  AcceleratorSample,
  GpuAllocation,
  NodeL1CacheUsage,
} from "@/foundation/lib/accelerator-observations";
import { formatL1CacheUsage } from "@/foundation/lib/accelerator-observations";
import { productPeakTflops } from "@/foundation/lib/accelerator-tflops";
import { compareDevicesByOrderThenUuid } from "@/foundation/lib/device-resource-utils";
import { formatToDecimal } from "@/foundation/lib/unit";
import { cn } from "@/foundation/lib/utils";
import type {
  ClusterResourceInfo,
  NodeResourceStatus,
} from "@/foundation/types/resource-types";
import { calcResourceUsage } from "../lib/calc-resource-usage";
import { observedGpuFromDevice } from "../lib/observed-gpu";
import { getAcceleratorProductQuantities } from "../lib/resource-status";
import { ResourceProgressBar } from "./ResourceProgressBar";

interface ProductGroupsBreakdownProps {
  allocatableGroups?: Record<string, number> | null;
  availableGroups?: Record<string, number> | null;
  t: (key: string, options?: Record<string, unknown>) => string;
}

const ProductGroupsBreakdown = ({
  allocatableGroups,
  availableGroups,
  t,
}: ProductGroupsBreakdownProps) => {
  if (!allocatableGroups || Object.keys(allocatableGroups).length === 0) {
    return null;
  }

  const entries = Object.entries(allocatableGroups);
  const usedByProduct = entries.map(([product, value]) => ({
    product,
    total: value,
    used: Math.max(value - (availableGroups?.[product] || 0), 0),
  }));

  return (
    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
      {usedByProduct.map((item) => (
        <span key={item.product}>
          {t("clusters.fields.cardUsageSummary", {
            product: item.product,
            used: formatToDecimal(item.used, 0),
            total: formatToDecimal(item.total, 0),
          })}
        </span>
      ))}
    </div>
  );
};

interface NodeResourcesTableProps {
  nodeResources: Record<string, NodeResourceStatus>;
  acceleratorTypes: string[];
  t: (key: string, options?: Record<string, unknown>) => string;
  framed?: boolean;
  className?: string;
  samples?: AcceleratorSample[];
  allocations?: GpuAllocation[];
  gpuView?: GpuObservationDisplay;
  /** Source of each product's peak FP16 TFLOPS. */
  clusterResourceInfo?: ClusterResourceInfo | null;
  tflopsOverrides?: Record<string, number>;
  observationStatus?: string;
  onObservationRetry?: () => void;
  l1CacheByNode?: Record<string, NodeL1CacheUsage>;
}

export const NodeResourcesTable = ({
  nodeResources,
  acceleratorTypes,
  t,
  framed = true,
  className,
  samples = [],
  allocations = [],
  gpuView = "table",
  clusterResourceInfo,
  tflopsOverrides,
  observationStatus,
  onObservationRetry,
  l1CacheByNode,
}: NodeResourcesTableProps) => {
  const sortedNodeEntries = Object.entries(nodeResources).sort(
    ([, left], [, right]) => {
      const leftHasGpu =
        (left.devices?.length ?? 0) > 0 ||
        Object.values(left.allocatable?.accelerator_groups ?? {}).some(
          (group) => group.quantity > 0,
        );
      const rightHasGpu =
        (right.devices?.length ?? 0) > 0 ||
        Object.values(right.allocatable?.accelerator_groups ?? {}).some(
          (group) => group.quantity > 0,
        );
      return Number(rightHasGpu) - Number(leftHasGpu);
    },
  );

  const [expandedNodeNames, setExpandedNodeNames] = useState<Set<string>>(
    () =>
      new Set(
        sortedNodeEntries
          .filter(([, node]) =>
            (node.devices ?? []).some((device) => device.health),
          )
          .map(([name]) => name),
      ),
  );

  const toggleNodeDevices = (nodeName: string) => {
    setExpandedNodeNames((current) => {
      const next = new Set(current);
      if (next.has(nodeName)) {
        next.delete(nodeName);
        return next;
      }

      next.add(nodeName);
      return next;
    });
  };

  const table = (
    <div className={cn("overflow-x-auto", !framed && className)}>
      <UITable>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[180px]">
              {t("clusters.fields.nodeName")}
            </TableHead>
            <TableHead className="min-w-[140px]">
              {t("common.fields.cpu")}
            </TableHead>
            <TableHead className="min-w-[140px]">
              {t("common.fields.memory")}
            </TableHead>
            {acceleratorTypes.map((accType) => (
              <TableHead key={accType} className="min-w-[140px]">
                {t(`clusters.acceleratorTypes.${accType}`, {
                  defaultValue: accType,
                })}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedNodeEntries.map(([nodeName, nodeStatus]) => {
            const hasDevices = (nodeStatus.devices?.length ?? 0) > 0;
            const isExpanded = expandedNodeNames.has(nodeName);
            const cpu = calcResourceUsage(
              nodeStatus.allocatable?.cpu || 0,
              nodeStatus.available?.cpu,
            );
            const memory = calcResourceUsage(
              nodeStatus.allocatable?.memory || 0,
              nodeStatus.available?.memory,
            );
            const sortedDevices = [...(nodeStatus.devices ?? [])].sort(
              compareDevicesByOrderThenUuid,
            );
            const showProduct =
              new Set(
                sortedDevices.map((device) => device.product).filter(Boolean),
              ).size > 1;
            const gpuRows = sortedDevices.map((device, index) => (
              <GpuObservationCard
                key={device.uuid}
                variant="inventory"
                display={gpuView}
                showProduct={showProduct}
                observationStatus={observationStatus}
                onRetry={onObservationRetry}
                device={{
                  ...observedGpuFromDevice(nodeName, device, index),
                  peakFP16TFLOPS: productPeakTflops(
                    clusterResourceInfo,
                    device.product,
                  ),
                }}
                tflopsOverrides={tflopsOverrides}
                samples={samples}
                allocations={allocations}
              />
            ));

            return (
              <Fragment key={nodeName}>
                <TableRow>
                  <TableCell className="font-medium align-top">
                    <div className="flex items-start gap-2">
                      {hasDevices ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          aria-label={t("clusters.actions.toggleNodeDevices", {
                            nodeName,
                          })}
                          aria-expanded={isExpanded}
                          onClick={() => toggleNodeDevices(nodeName)}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      ) : (
                        <span className="h-7 w-7 shrink-0" />
                      )}
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-[var(--nt-stroke-neutral-trans-2)] text-muted-foreground">
                        <Server aria-hidden="true" className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 break-all pt-1">{nodeName}</span>
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <ResourceProgressBar
                      label=""
                      used={cpu.used}
                      total={nodeStatus.allocatable?.cpu || 0}
                      compact
                      series="teal"
                    />
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="space-y-2">
                      <ResourceProgressBar
                        label=""
                        used={memory.used}
                        total={nodeStatus.allocatable?.memory || 0}
                        unit="GiB"
                        compact
                        series="violet"
                      />
                      {l1CacheByNode?.[nodeName] &&
                        (() => {
                          const l1 = l1CacheByNode[nodeName];
                          const l1Ratio =
                            l1.usedGiB != null && l1.capacityGiB > 0
                              ? Math.min(
                                  100,
                                  Math.max(
                                    0,
                                    (l1.usedGiB / l1.capacityGiB) * 100,
                                  ),
                                )
                              : null;
                          return (
                            <div
                              className="space-y-1 text-xs text-muted-foreground"
                              data-testid="node-l1-cache-bar"
                            >
                              <div className="flex items-center justify-between gap-2 tabular-nums">
                                <span>
                                  {t("observations.l1KvCache")}{" "}
                                  {formatL1CacheUsage(l1)}
                                </span>
                                <span>
                                  {l1Ratio != null
                                    ? `${Math.round(l1Ratio)}%`
                                    : "—"}
                                </span>
                              </div>
                              <MetricBar
                                size="sm"
                                series="blue"
                                value={l1Ratio}
                                track="subtle"
                              />
                            </div>
                          );
                        })()}
                    </div>
                  </TableCell>
                  {acceleratorTypes.map((accType) => {
                    const accGroup =
                      nodeStatus.allocatable?.accelerator_groups?.[accType];
                    const availableAccGroup =
                      nodeStatus.available?.accelerator_groups?.[accType];
                    const accAllocatable = accGroup?.quantity || 0;
                    return (
                      <TableCell key={accType} className="align-middle">
                        {accAllocatable === 0 ? (
                          <EmptyValue />
                        ) : (
                          <div>
                            <ProductGroupsBreakdown
                              allocatableGroups={getAcceleratorProductQuantities(
                                accGroup,
                              )}
                              availableGroups={getAcceleratorProductQuantities(
                                availableAccGroup,
                              )}
                              t={t}
                            />
                          </div>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
                {isExpanded && hasDevices && (
                  <TableRow>
                    <TableCell colSpan={3 + acceleratorTypes.length}>
                      {gpuView === "table" ? (
                        <div className="overflow-x-auto rounded-md border border-[var(--nt-stroke-neutral-trans-2)]">
                          <div role="table">
                            <GpuObservationTableHeader variant="inventory" />
                            {gpuRows}
                          </div>
                        </div>
                      ) : (
                        <div
                          role="list"
                          className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]"
                        >
                          {gpuRows}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </UITable>
    </div>
  );

  if (!framed) {
    return table;
  }

  return (
    <Card className={cn("mt-4", className)}>
      <CardHeader>
        <CardTitle>{t("clusters.sections.nodes")}</CardTitle>
      </CardHeader>
      <CardContent>{table}</CardContent>
    </Card>
  );
};
