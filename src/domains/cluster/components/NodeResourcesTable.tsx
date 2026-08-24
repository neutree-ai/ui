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
import { GpuDeviceResourcesView } from "@/foundation/components/GpuDeviceResourcesView";
import { formatToDecimal } from "@/foundation/lib/unit";
import { cn } from "@/foundation/lib/utils";
import type { NodeResourceStatus } from "@/foundation/types/resource-types";
import { calcResourceUsage } from "../lib/calc-resource-usage";
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
}

export const NodeResourcesTable = ({
  nodeResources,
  acceleratorTypes,
  t,
  framed = true,
  className,
}: NodeResourcesTableProps) => {
  const gpuGridColumns = Math.min(
    4,
    Math.max(
      1,
      ...Object.values(nodeResources).map((node) => node.devices?.length ?? 0),
    ),
  );
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
                      series="green"
                    />
                  </TableCell>
                  <TableCell className="align-top">
                    <ResourceProgressBar
                      label=""
                      used={memory.used}
                      total={nodeStatus.allocatable?.memory || 0}
                      unit="GiB"
                      compact
                      series="purple"
                    />
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
                          <span className="text-muted-foreground">-</span>
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
                      <div className="pl-9">
                        <GpuDeviceResourcesView
                          nodeResources={{ [nodeName]: nodeStatus }}
                          labels={{
                            title: t("clusters.sections.nodeDevices"),
                            deviceCount: t("clusters.fields.deviceCount"),
                            healthyDevices: t("clusters.fields.healthyDevices"),
                            memoryUsage: t("clusters.fields.memoryUsage"),
                            coreUsage: t("clusters.fields.coreUsage"),
                            allProducts: t("clusters.options.allGpuProducts"),
                            allNodes: t("clusters.options.allNodes"),
                            allDevices: t("clusters.options.allDevices"),
                            searchPlaceholder: t(
                              "clusters.placeholders.searchGpuDevices",
                            ),
                            gpuNumber: t("clusters.fields.gpuNumber"),
                            uuid: t("clusters.fields.deviceUuid"),
                            status: t("common.fields.status"),
                            healthy: t("clusters.options.healthy"),
                            unhealthy: t("clusters.options.unhealthy"),
                            node: t("clusters.fields.nodeName"),
                            product: t("common.fields.acceleratorProduct"),
                            selected: t("clusters.fields.selected"),
                            usable: t("clusters.options.usable"),
                            free: t("clusters.options.free"),
                            allocated: t("clusters.options.allocated"),
                            resourceScope: t("clusters.fields.resourceScope"),
                            freeCards: t("clusters.options.freeCards"),
                            usableForRequest: t(
                              "clusters.options.usableForRequest",
                            ),
                            copyUuid: t("clusters.actions.copyUuid"),
                            copyUuidSuccess: t(
                              "clusters.messages.copyUuidSuccess",
                            ),
                            copyUuidFailed: t(
                              "clusters.messages.copyUuidFailed",
                            ),
                            remaining: t("clusters.fields.remaining"),
                            usedSlashTotal: t("clusters.fields.usedSlashTotal"),
                            empty: t("clusters.messages.noGpuDevices"),
                          }}
                          showFilters={false}
                          showSummary={false}
                          showNodeColumn={false}
                          showHeader={false}
                          variant="grid"
                          gridColumns={gpuGridColumns}
                        />
                      </div>
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
