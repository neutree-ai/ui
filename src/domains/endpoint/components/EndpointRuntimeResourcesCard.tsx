import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getEndpointReplicaResourceRows,
  getEndpointResourceSummaryRows,
} from "@/domains/endpoint/lib/resource-status";
import { formatToDecimal } from "@/foundation/lib/unit";
import type { EndpointResourceStatus } from "@/foundation/types/resource-types";

type EndpointRuntimeResourcesCardProps = {
  resources: EndpointResourceStatus | null | undefined;
};

const formatInteger = (value: number) => formatToDecimal(value, 0) ?? "-";

export default function EndpointRuntimeResourcesCard({
  resources,
}: EndpointRuntimeResourcesCardProps) {
  const { t } = useTranslation();
  const summaryRows = getEndpointResourceSummaryRows(resources);
  const replicaRows = getEndpointReplicaResourceRows(resources);

  if (summaryRows.length === 0 && replicaRows.length === 0) {
    return null;
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>{t("endpoints.sections.runtimeResources")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {summaryRows.length > 0 && (
          <div className="overflow-x-auto">
            <div className="mb-2 text-sm font-medium">
              {t("endpoints.sections.resourceSummary")}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.fields.acceleratorProduct")}</TableHead>
                  <TableHead>{t("endpoints.fields.vgpuMemory")}</TableHead>
                  <TableHead>{t("endpoints.fields.vgpuCoreUnits")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaryRows.map((row) => (
                  <TableRow key={row.product}>
                    <TableCell className="font-medium">{row.product}</TableCell>
                    <TableCell>{formatInteger(row.memoryMiB)} MiB</TableCell>
                    <TableCell>{formatInteger(row.coreUnits)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {replicaRows.length > 0 && (
          <div className="overflow-x-auto">
            <div className="mb-2 text-sm font-medium">
              {t("endpoints.sections.replicaResources")}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("endpoints.fields.instance")}</TableHead>
                  <TableHead>{t("common.fields.replica")}</TableHead>
                  <TableHead>{t("clusters.fields.nodeName")}</TableHead>
                  <TableHead>{t("common.fields.acceleratorProduct")}</TableHead>
                  <TableHead>{t("clusters.fields.deviceUuid")}</TableHead>
                  <TableHead>{t("endpoints.fields.vgpuMemory")}</TableHead>
                  <TableHead>{t("endpoints.fields.vgpuCoreUnits")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {replicaRows.map((row) => (
                  <TableRow key={`${row.instanceId}:${row.uuid}`}>
                    <TableCell className="font-medium">
                      {row.instanceId || "-"}
                    </TableCell>
                    <TableCell>{row.replicaId || "-"}</TableCell>
                    <TableCell>{row.nodeId || "-"}</TableCell>
                    <TableCell>{row.product || "-"}</TableCell>
                    <TableCell>
                      <code className="break-all text-xs">{row.uuid}</code>
                    </TableCell>
                    <TableCell>{formatInteger(row.memoryMiB)} MiB</TableCell>
                    <TableCell>{formatInteger(row.coreUnits)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
