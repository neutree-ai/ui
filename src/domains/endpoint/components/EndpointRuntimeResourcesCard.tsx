import { Copy } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getEndpointReplicaResourceGroups,
  getEndpointResourceSummaryRows,
} from "@/domains/endpoint/lib/resource-status";
import { useCopyToClipboard } from "@/foundation/hooks/use-copy-to-clipboard";
import { formatMiBAsGiB, formatToDecimal } from "@/foundation/lib/unit";
import { cn } from "@/foundation/lib/utils";
import type { EndpointResourceStatus } from "@/foundation/types/resource-types";
import type { ResourceSpec } from "@/foundation/types/serving-types";

type EndpointRuntimeResourcesCardProps = {
  configuredResources?: ResourceSpec | null;
  resources: EndpointResourceStatus | null | undefined;
  className?: string;
};

type AcceleratorWithFlatVirtualization = NonNullable<
  ResourceSpec["accelerator"]
> &
  Record<string, unknown>;

const FLAT_CORE_PERCENT_KEY = "virtualization.core_percent";

const formatInteger = (value: number) => formatToDecimal(value, 0) ?? "-";

const formatCoreLimit = (value: number) =>
  value > 0 ? formatInteger(value) : "-";

const formatMemoryGiB = (value: number) => formatMiBAsGiB(value) ?? "-";

const formatCount = (
  count: number,
  singular: string,
  plural: string,
  t: (key: string) => string,
) => `${count} ${t(count === 1 ? singular : plural)}`;

const formatAllocatedCardCount = (count: number, t: (key: string) => string) =>
  `${count} ${t(
    count === 1
      ? "endpoints.fields.allocatedCard"
      : "endpoints.fields.allocatedCards",
  )}`;

const parsePositiveNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const getConfiguredCorePercent = (
  configuredResources: ResourceSpec | null | undefined,
) => {
  const accelerator = configuredResources?.accelerator as
    | AcceleratorWithFlatVirtualization
    | null
    | undefined;
  const value =
    accelerator?.virtualization?.core_percent ??
    accelerator?.[FLAT_CORE_PERCENT_KEY];

  return parsePositiveNumber(value);
};

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
  configuredResources,
  resources,
  className,
}: EndpointRuntimeResourcesCardProps) {
  const { t } = useTranslation();
  const { copy } = useCopyToClipboard();
  const configuredCorePercent = getConfiguredCorePercent(configuredResources);
  const coreLimitText =
    configuredCorePercent != null
      ? formatCoreLimit(configuredCorePercent)
      : "-";

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
    <div className={cn("space-y-4", className)}>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <div className="min-w-0">
          <div className="text-sm font-medium">
            {t("endpoints.sections.allocatedResources")}
          </div>
          {allocatedDeviceCount > 0 && (
            <div className="mt-0.5 text-xs text-muted-foreground">
              {formatCount(
                replicaGroups.length,
                "endpoints.fields.replicaUnit",
                "endpoints.fields.replicaUnits",
                t,
              )}{" "}
              / {formatAllocatedCardCount(allocatedDeviceCount, t)}
            </div>
          )}
        </div>
      </div>

      {summaryRows.length > 0 && (
        <div className="grid gap-2" data-testid="runtime-resource-summary">
          {summaryRows.map((row) => (
            <div
              className="grid min-w-0 gap-4 rounded-md border px-3 py-2 md:grid-cols-[minmax(180px,1.2fr)_repeat(2,minmax(120px,1fr))] md:items-center"
              key={row.product}
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/10 text-xs font-bold text-primary">
                  {t("clusters.fields.gpuNumber")}
                </div>
                <div className="min-w-0">
                  <span className="block text-xs leading-4 text-muted-foreground">
                    {t("common.fields.acceleratorProduct")}
                  </span>
                  <strong className="block truncate text-sm font-semibold leading-5">
                    {row.product || "-"}
                  </strong>
                </div>
              </div>
              <ResourceValue
                className="border-0 bg-transparent p-0"
                label={t("clusters.fields.memoryUsage")}
                value={formatMemoryGiB(row.memoryMiB)}
              />
              <ResourceValue
                className="border-0 bg-transparent p-0"
                label={t("clusters.fields.coreUsage")}
                value={coreLimitText}
              />
            </div>
          ))}
        </div>
      )}

      {replicaGroups.length > 0 && (
        <div className="grid gap-2.5" data-testid="runtime-replica-groups">
          <div className="text-sm font-medium">
            {t("endpoints.sections.replicaResources")}
          </div>
          {replicaGroups.map((group, groupIndex) => {
            const groupKey = `${group.instanceId}:${group.replicaId}:${groupIndex}`;
            const replicaName = group.replicaId || group.instanceId || "-";

            return (
              <div
                className="overflow-hidden rounded-md border bg-[var(--nt-fill-neutral-opaque-1)] dark:bg-[var(--nt-fill-neutral-opaque-2)]"
                key={groupKey}
              >
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="shrink-0 text-xs font-medium leading-4 text-muted-foreground">
                      {t("common.fields.replica")}
                    </span>
                    <strong
                      className="min-w-0 truncate text-sm font-semibold leading-5"
                      title={replicaName}
                    >
                      {replicaName}
                    </strong>
                  </div>
                  <div className="flex min-w-0 flex-wrap justify-end gap-1">
                    <Badge
                      variant="outline"
                      className="h-6 bg-card px-2 text-xs font-medium"
                    >
                      {formatCount(
                        group.deviceCount,
                        "endpoints.fields.card",
                        "endpoints.fields.cards",
                        t,
                      )}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="h-6 bg-card px-2 text-xs font-medium"
                    >
                      {formatMemoryGiB(group.memoryMiB)}{" "}
                      {t("endpoints.fields.vgpuMemory")}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="h-6 bg-card px-2 text-xs font-medium"
                    >
                      {t("endpoints.fields.vgpuCoreCapacity")} {coreLimitText}
                    </Badge>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <div className="grid min-w-[760px] grid-cols-[96px_minmax(180px,1.2fr)_minmax(96px,0.6fr)_minmax(72px,0.45fr)_minmax(140px,0.75fr)] gap-3 border-b px-3 py-2 text-xs font-medium leading-4 text-muted-foreground">
                    <span>{t("clusters.fields.gpuNumber")}</span>
                    <span>{t("common.fields.acceleratorProduct")}</span>
                    <span>{t("clusters.fields.memoryUsage")}</span>
                    <span>{t("clusters.fields.coreUsage")}</span>
                    <span>{t("clusters.fields.nodeName")}</span>
                  </div>
                  {group.devices.map((device, index) => {
                    const gpuNumber = device.order ?? index + 1;

                    return (
                      <div
                        className="grid min-w-[760px] grid-cols-[96px_minmax(180px,1.2fr)_minmax(96px,0.6fr)_minmax(72px,0.45fr)_minmax(140px,0.75fr)] items-center gap-3 border-b px-3 py-2.5 text-sm last:border-b-0"
                        key={`${groupKey}:${device.uuid || index}`}
                      >
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          title={t("clusters.actions.copyUuid")}
                          aria-label={`${t("clusters.fields.gpuNumber")} ${gpuNumber} ${t("clusters.actions.copyUuid")}`}
                          className="-ml-2 h-7 min-w-0 justify-start px-2 text-sm font-medium"
                          onClick={() =>
                            copy(device.uuid, {
                              successMessage: t(
                                "clusters.messages.copyUuidSuccess",
                              ),
                              errorMessage: t(
                                "clusters.messages.copyUuidFailed",
                              ),
                            })
                          }
                        >
                          {t("clusters.fields.gpuNumber")} {gpuNumber}
                          <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="sr-only">
                            {t("clusters.actions.copyUuid")}
                          </span>
                        </Button>
                        <span className="min-w-0 truncate font-semibold">
                          {device.product || "-"}
                        </span>
                        <span className="font-semibold">
                          {formatMemoryGiB(device.memoryMiB)}
                        </span>
                        <span className="font-semibold">{coreLimitText}</span>
                        <span className="min-w-0 truncate font-semibold">
                          {device.nodeId || "-"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
