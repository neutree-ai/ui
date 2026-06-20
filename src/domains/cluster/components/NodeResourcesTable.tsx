import { ChevronDown, ChevronRight } from "lucide-react";
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
}

export const ProductGroupsBreakdown = ({
  allocatableGroups,
  availableGroups,
}: ProductGroupsBreakdownProps) => {
  if (!allocatableGroups || Object.keys(allocatableGroups).length === 0) {
    return null;
  }

  return (
    <div className="mt-2 ml-4 space-y-1">
      {Object.entries(allocatableGroups).map(([product, total]) => {
        const productUsed = total - (availableGroups?.[product] || 0);
        return (
          <div
            key={product}
            className="text-xs text-muted-foreground flex items-center justify-between"
          >
            <span>{product}</span>
            <span>
              {formatToDecimal(productUsed)} / {formatToDecimal(total)}
            </span>
          </div>
        );
      })}
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
  const [expandedNodeNames, setExpandedNodeNames] = useState<Set<string>>(
    () => new Set(),
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
          {Object.entries(nodeResources).map(([nodeName, nodeStatus]) => {
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
                      <span className="min-w-0 break-all pt-1">{nodeName}</span>
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <ResourceProgressBar
                      label=""
                      used={cpu.used}
                      total={nodeStatus.allocatable?.cpu || 0}
                      compact
                    />
                  </TableCell>
                  <TableCell className="align-top">
                    <ResourceProgressBar
                      label=""
                      used={memory.used}
                      total={nodeStatus.allocatable?.memory || 0}
                      unit="GiB"
                      compact
                    />
                  </TableCell>
                  {acceleratorTypes.map((accType) => {
                    const accGroup =
                      nodeStatus.allocatable?.accelerator_groups?.[accType];
                    const availableAccGroup =
                      nodeStatus.available?.accelerator_groups?.[accType];
                    const accAllocatable = accGroup?.quantity || 0;
                    const acc = calcResourceUsage(
                      accAllocatable,
                      availableAccGroup?.quantity,
                    );

                    return (
                      <TableCell key={accType} className="align-top">
                        {accAllocatable === 0 ? (
                          <span className="text-muted-foreground">-</span>
                        ) : (
                          <div>
                            <ResourceProgressBar
                              label=""
                              used={acc.used}
                              total={accAllocatable}
                              compact
                            />
                            <ProductGroupsBreakdown
                              allocatableGroups={getAcceleratorProductQuantities(
                                accGroup,
                              )}
                              availableGroups={getAcceleratorProductQuantities(
                                availableAccGroup,
                              )}
                            />
                          </div>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
                {isExpanded && hasDevices && (
                  <TableRow>
                    <TableCell
                      colSpan={3 + acceleratorTypes.length}
                      className="bg-muted/30"
                    >
                      <div className="py-3 pl-9">
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
                          className="bg-background"
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
