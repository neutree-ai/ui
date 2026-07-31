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

// Metrics truncate so rows keep an even height, but identifiers the user came
// here to read — the GPU product above all — pass `wrap` and get the whole
// string. A plain string value always carries a title so a clipped one stays
// readable on hover.
const ResourceValue = ({
  label,
  value,
  className,
  wrap = false,
}: {
  label: string;
  value: ReactNode;
  className?: string;
  wrap?: boolean;
}) => (
  <div
    className={cn(
      "grid min-w-0 content-center gap-1 rounded-md border bg-background px-3 py-2",
      className,
    )}
  >
    <span className="text-xs leading-4 text-muted-foreground">{label}</span>
    <strong
      className={cn(
        "min-w-0 text-sm font-semibold leading-5",
        wrap ? "break-words" : "truncate",
      )}
      title={typeof value === "string" ? value : undefined}
    >
      {value}
    </strong>
  </div>
);

export default function EndpointRuntimeResourcesCard({
  configuredResources,
  resources,
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
    <div className="mt-6 space-y-4 border-t pt-4">
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
              className="grid min-w-0 gap-2 md:grid-cols-[minmax(180px,1.2fr)_repeat(2,minmax(120px,1fr))]"
              key={row.product}
            >
              <div className="flex min-w-0 items-center gap-3 rounded-md border bg-background px-3 py-2">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/10 text-xs font-bold text-primary">
                  {t("clusters.fields.gpuNumber")}
                </div>
                <div className="min-w-0">
                  <span className="block text-xs leading-4 text-muted-foreground">
                    {t("common.fields.acceleratorProduct")}
                  </span>
                  <strong
                    className="block break-words text-sm font-semibold leading-5"
                    title={row.product}
                  >
                    {row.product || "-"}
                  </strong>
                </div>
              </div>
              <ResourceValue
                label={t("clusters.fields.memoryUsage")}
                value={formatMemoryGiB(row.memoryMiB)}
              />
              <ResourceValue
                label={t("clusters.fields.coreUsage")}
                value={coreLimitText}
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
                      {formatCount(
                        group.deviceCount,
                        "endpoints.fields.card",
                        "endpoints.fields.cards",
                        t,
                      )}
                    </Badge>
                    <Badge variant="outline" className="bg-muted/40">
                      {formatMemoryGiB(group.memoryMiB)}{" "}
                      {t("endpoints.fields.vgpuMemory")}
                    </Badge>
                    <Badge variant="outline" className="bg-muted/40">
                      {t("endpoints.fields.vgpuCoreCapacity")} {coreLimitText}
                    </Badge>
                  </div>
                </div>

                <div className="grid gap-2">
                  {group.devices.map((device, index) => {
                    const gpuNumber = device.order ?? index + 1;

                    return (
                      <div
                        className="grid min-w-0 gap-2 rounded-md border bg-muted/30 p-2 lg:grid-cols-[72px_minmax(110px,0.9fr)_minmax(86px,0.6fr)_minmax(76px,0.5fr)_minmax(120px,0.8fr)] lg:items-center"
                        key={`${groupKey}:${device.uuid || index}`}
                      >
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          title={t("clusters.actions.copyUuid")}
                          aria-label={`${t("clusters.fields.gpuNumber")} ${gpuNumber} ${t("clusters.actions.copyUuid")}`}
                          className="-ml-2 h-7 min-w-0 justify-start px-2 text-xs"
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
                          <Copy className="h-3 w-3 shrink-0 text-muted-foreground" />
                          <span className="sr-only">
                            {t("clusters.actions.copyUuid")}
                          </span>
                        </Button>
                        <ResourceValue
                          className="border-0 bg-transparent p-0"
                          label={t("common.fields.acceleratorProduct")}
                          value={device.product || "-"}
                          wrap
                        />
                        <ResourceValue
                          className="border-0 bg-transparent p-0"
                          label={t("clusters.fields.memoryUsage")}
                          value={formatMemoryGiB(device.memoryMiB)}
                        />
                        <ResourceValue
                          className="border-0 bg-transparent p-0"
                          label={t("clusters.fields.coreUsage")}
                          value={coreLimitText}
                        />
                        <ResourceValue
                          className="border-0 bg-transparent p-0"
                          label={t("clusters.fields.nodeName")}
                          value={device.nodeId || "-"}
                        />
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
