import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import {
  getEndpointReplicaResourceGroups,
  getEndpointResourceSummaryRows,
} from "@/domains/endpoint/lib/resource-status";
import { formatMiBAsGiB, formatToDecimal } from "@/foundation/lib/unit";
import { cn } from "@/foundation/lib/utils";
import type { EndpointResourceStatus } from "@/foundation/types/resource-types";

type EndpointRuntimeResourcesCardProps = {
  resources: EndpointResourceStatus | null | undefined;
};

const formatInteger = (value: number) => formatToDecimal(value, 0) ?? "-";

const formatMemoryGiB = (value: number) => formatMiBAsGiB(value) ?? "-";

const formatCount = (count: number, singular: string, plural: string) =>
  `${count} ${count === 1 ? singular : plural}`;

const formatAllocatedCardCount = (count: number) =>
  `${count} allocated ${count === 1 ? "card" : "cards"}`;

const ResourceValue = ({
  label,
  value,
  className,
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      "grid min-w-0 content-center gap-1 rounded-md border bg-background px-3 py-2",
      className,
    )}
  >
    <span className="text-xs leading-4 text-muted-foreground">{label}</span>
    <strong className="min-w-0 truncate text-sm font-semibold leading-5">
      {value}
    </strong>
  </div>
);

export default function EndpointRuntimeResourcesCard({
  resources,
}: EndpointRuntimeResourcesCardProps) {
  const { t } = useTranslation();

  const summaryRows = getEndpointResourceSummaryRows(resources);
  const replicaGroups = getEndpointReplicaResourceGroups(resources);
  const allocatedDeviceCount = replicaGroups.reduce(
    (sum, group) => sum + group.deviceCount,
    0,
  );

  if (summaryRows.length === 0 && replicaGroups.length === 0) {
    return null;
  }

  return (
    <div className="mt-6 space-y-4 border-t pt-4">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <div className="min-w-0">
          <div className="text-sm font-medium">
            {t("endpoints.sections.allocatedResources")}
          </div>
          {allocatedDeviceCount > 0 && (
            <div className="mt-0.5 text-xs text-muted-foreground">
              {formatCount(replicaGroups.length, "replica", "replicas")} /{" "}
              {formatAllocatedCardCount(allocatedDeviceCount)}
            </div>
          )}
        </div>
      </div>

      {summaryRows.length > 0 && (
        <div className="grid gap-2" data-testid="runtime-resource-summary">
          {summaryRows.map((row) => (
            <div
              className="grid min-w-0 gap-2 md:grid-cols-[minmax(180px,1.2fr)_repeat(2,minmax(120px,1fr))]"
              key={row.product}
            >
              <div className="flex min-w-0 items-center gap-3 rounded-md border bg-background px-3 py-2">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/10 text-xs font-bold text-primary">
                  GPU
                </div>
                <div className="min-w-0">
                  <strong className="block truncate text-sm font-semibold leading-5">
                    {row.product || "-"}
                  </strong>
                  <span className="block text-xs leading-4 text-muted-foreground">
                    {t("common.fields.acceleratorProduct")}
                  </span>
                </div>
              </div>
              <ResourceValue
                label={t("endpoints.fields.vgpuMemory")}
                value={formatMemoryGiB(row.memoryMiB)}
              />
              <ResourceValue
                label={t("endpoints.fields.vgpuCoreUnits")}
                value={formatInteger(row.coreUnits)}
              />
            </div>
          ))}
        </div>
      )}

      {replicaGroups.length > 0 && (
        <div className="grid gap-2" data-testid="runtime-replica-groups">
          <div className="text-sm font-medium">
            {t("endpoints.sections.replicaResources")}
          </div>
          {replicaGroups.map((group, groupIndex) => {
            const groupKey = `${group.instanceId}:${group.replicaId}:${groupIndex}`;
            const replicaName = group.replicaId || group.instanceId || "-";

            return (
              <div
                className="grid gap-2 rounded-md border bg-background p-3"
                key={groupKey}
              >
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-2 border-b pb-2">
                  <div className="min-w-0">
                    <span className="block text-xs leading-4 text-muted-foreground">
                      {t("common.fields.replica")}
                    </span>
                    <strong
                      className="block min-w-0 truncate text-sm font-semibold leading-5"
                      title={replicaName}
                    >
                      {replicaName}
                    </strong>
                  </div>
                  <div className="flex min-w-0 flex-wrap justify-end gap-1.5">
                    <Badge variant="outline" className="bg-muted/40">
                      {formatCount(group.deviceCount, "card", "cards")}
                    </Badge>
                    <Badge variant="outline" className="bg-muted/40">
                      {formatMemoryGiB(group.memoryMiB)} VRAM
                    </Badge>
                    <Badge variant="outline" className="bg-muted/40">
                      Core {formatInteger(group.coreUnits)}
                    </Badge>
                  </div>
                </div>

                <div className="grid gap-2">
                  {group.devices.map((device, index) => (
                    <div
                      className="grid min-w-0 gap-2 rounded-md border bg-muted/30 p-2 lg:grid-cols-[56px_minmax(110px,0.9fr)_minmax(86px,0.6fr)_minmax(76px,0.5fr)_minmax(120px,0.8fr)_minmax(180px,1.3fr)] lg:items-center"
                      key={`${groupKey}:${device.uuid || index}`}
                    >
                      <div className="inline-flex min-h-7 w-fit min-w-12 items-center justify-center rounded-md bg-primary/10 px-2 text-xs font-bold text-primary">
                        GPU {index}
                      </div>
                      <ResourceValue
                        className="border-0 bg-transparent p-0"
                        label={t("common.fields.acceleratorProduct")}
                        value={device.product || "-"}
                      />
                      <ResourceValue
                        className="border-0 bg-transparent p-0"
                        label={t("endpoints.fields.vgpuMemory")}
                        value={formatMemoryGiB(device.memoryMiB)}
                      />
                      <ResourceValue
                        className="border-0 bg-transparent p-0"
                        label={t("endpoints.fields.vgpuCoreUnits")}
                        value={formatInteger(device.coreUnits)}
                      />
                      <ResourceValue
                        className="border-0 bg-transparent p-0"
                        label={t("clusters.fields.nodeName")}
                        value={device.nodeId || "-"}
                      />
                      <ResourceValue
                        className="border-0 bg-transparent p-0"
                        label={t("clusters.fields.deviceUuid")}
                        value={
                          <code className="block truncate text-xs">
                            {device.uuid || "-"}
                          </code>
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
