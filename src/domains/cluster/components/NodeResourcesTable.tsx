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
import { formatToDecimal } from "@/foundation/lib/unit";
import type { NodeResourceStatus } from "@/foundation/types/resource-types";
import { calcResourceUsage } from "../lib/calc-resource-usage";
import {
  getAcceleratorProductQuantities,
  getNodeDeviceResourceRows,
} from "../lib/resource-status";
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

const formatPoolRatio = (
  available: number | null,
  allocatable: number | null,
  unit = "",
) => {
  if (available == null && allocatable == null) {
    return "-";
  }

  const value = `${available == null ? "-" : formatToDecimal(available, 0)} / ${
    allocatable == null ? "-" : formatToDecimal(allocatable, 0)
  }`;

  return unit ? `${value} ${unit}` : value;
};

interface NodeResourcesTableProps {
  nodeResources: Record<string, NodeResourceStatus>;
  acceleratorTypes: string[];
  t: (key: string, options?: { defaultValue?: string }) => string;
}

export const NodeResourcesTable = ({
  nodeResources,
  acceleratorTypes,
  t,
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

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>{t("clusters.sections.nodes")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <UITable>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>{t("clusters.fields.nodeName")}</TableHead>
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
                const deviceRows = getNodeDeviceResourceRows({
                  [nodeName]: nodeStatus,
                });
                const hasDevices = deviceRows.length > 0;
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
                      <TableCell className="align-top">
                        {hasDevices ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            aria-label={`${nodeName} devices`}
                            aria-expanded={isExpanded}
                            onClick={() => toggleNodeDevices(nodeName)}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        ) : null}
                      </TableCell>
                      <TableCell className="font-medium">{nodeName}</TableCell>
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
                        <TableCell />
                        <TableCell
                          colSpan={3 + acceleratorTypes.length}
                          className="bg-muted/30"
                        >
                          <div className="py-3">
                            <div className="mb-2 text-sm font-medium">
                              {t("clusters.sections.nodeDevices")}
                            </div>
                            <div className="overflow-x-auto rounded-md border bg-background">
                              <UITable>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>
                                      {t("common.fields.acceleratorProduct")}
                                    </TableHead>
                                    <TableHead>
                                      {t("clusters.fields.deviceUuid")}
                                    </TableHead>
                                    <TableHead>
                                      {t("common.fields.status")}
                                    </TableHead>
                                    <TableHead>
                                      {t("clusters.fields.vgpuMemoryPool")}
                                    </TableHead>
                                    <TableHead>
                                      {t("clusters.fields.vgpuCorePool")}
                                    </TableHead>
                                    <TableHead>
                                      {t("clusters.fields.vgpuSlotPool")}
                                    </TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {deviceRows.map((row) => (
                                    <TableRow key={row.uuid}>
                                      <TableCell>
                                        {row.product || "-"}
                                      </TableCell>
                                      <TableCell>
                                        <code className="break-all text-xs">
                                          {row.uuid}
                                        </code>
                                      </TableCell>
                                      <TableCell>
                                        {row.healthy
                                          ? t("clusters.options.healthy")
                                          : t("clusters.options.unhealthy")}
                                      </TableCell>
                                      <TableCell>
                                        {formatPoolRatio(
                                          row.availableMemoryMiB,
                                          row.allocatableMemoryMiB,
                                          "MiB",
                                        )}
                                      </TableCell>
                                      <TableCell>
                                        {formatPoolRatio(
                                          row.availableCoreUnits,
                                          row.allocatableCoreUnits,
                                        )}
                                      </TableCell>
                                      <TableCell>
                                        {formatPoolRatio(
                                          row.availableSlots,
                                          row.allocatableSlots,
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </UITable>
                            </div>
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
      </CardContent>
    </Card>
  );
};
