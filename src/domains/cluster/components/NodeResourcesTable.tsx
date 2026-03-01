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
import { calcResourceUsage } from "../lib/calc-resource-usage";
import type { ResourceStatus } from "../types";
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
  nodeResources: Record<string, ResourceStatus>;
  acceleratorTypes: string[];
  t: (key: string, options?: { defaultValue?: string }) => string;
}

export const NodeResourcesTable = ({
  nodeResources,
  acceleratorTypes,
  t,
}: NodeResourcesTableProps) => (
  <Card className="mt-4">
    <CardHeader>
      <CardTitle>{t("clusters.sections.nodes")}</CardTitle>
    </CardHeader>
    <CardContent>
      <UITable>
        <TableHeader>
          <TableRow>
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
            const cpu = calcResourceUsage(
              nodeStatus.allocatable?.cpu || 0,
              nodeStatus.available?.cpu,
            );
            const memory = calcResourceUsage(
              nodeStatus.allocatable?.memory || 0,
              nodeStatus.available?.memory,
            );

            return (
              <TableRow key={nodeName}>
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
                  const accAllocatable = accGroup?.quantity || 0;
                  const acc = calcResourceUsage(
                    accAllocatable,
                    nodeStatus.available?.accelerator_groups?.[accType]
                      ?.quantity,
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
                            allocatableGroups={accGroup?.product_groups}
                            availableGroups={
                              nodeStatus.available?.accelerator_groups?.[
                                accType
                              ]?.product_groups
                            }
                          />
                        </div>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
        </TableBody>
      </UITable>
    </CardContent>
  </Card>
);
