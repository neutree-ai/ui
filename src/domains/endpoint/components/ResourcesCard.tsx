import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { normalizeEndpointResourcesForForm } from "@/domains/endpoint/lib/endpoint-form-helpers";
import {
  getVgpuMemoryDisplay,
  getVgpuVirtualization,
  hasVgpuResources,
} from "@/domains/endpoint/lib/vgpu";
import { ShowPage } from "@/foundation/components/ShowPage";
import { formatToDecimal } from "@/foundation/lib/unit";
import type { ResourceSpec } from "@/foundation/types/serving-types";

interface ResourcesCardProps {
  resources: ResourceSpec | null;
  showGpuConditionally?: boolean;
  titleTranslationKey?: string;
}

export default function ResourcesCard({
  resources,
  showGpuConditionally = false,
  titleTranslationKey = "common.fields.resources",
}: ResourcesCardProps) {
  const { t } = useTranslation();
  const displayResources = normalizeEndpointResourcesForForm(
    resources as unknown as Record<string, unknown> | null | undefined,
  );

  const shouldShowGpu = showGpuConditionally
    ? Boolean(displayResources?.gpu && displayResources.gpu > 0)
    : true;

  const hasAccelerator = Boolean(
    displayResources?.accelerator?.type &&
      displayResources?.accelerator?.product,
  );
  const vgpuVirtualization = getVgpuVirtualization(
    displayResources?.accelerator,
  );
  const isVgpu = hasVgpuResources(displayResources);
  const vgpuMemory = getVgpuMemoryDisplay(vgpuVirtualization, undefined);
  const vgpuCorePercent =
    vgpuVirtualization?.core_percent !== undefined
      ? formatToDecimal(vgpuVirtualization.core_percent, 0)
      : "-";

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>{t(titleTranslationKey)}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-8">
          {shouldShowGpu && (
            <ShowPage.Row title={t("common.fields.gpu")}>
              {formatToDecimal(displayResources?.gpu) ?? "-"}
            </ShowPage.Row>
          )}
          <ShowPage.Row title={t("common.fields.cpu")}>
            {formatToDecimal(displayResources?.cpu) ?? "-"}
          </ShowPage.Row>
          <ShowPage.Row title={t("common.fields.memory")}>
            {formatToDecimal(displayResources?.memory) ?? "-"}
          </ShowPage.Row>
        </div>

        {hasAccelerator && displayResources?.accelerator && (
          <div className="mt-4">
            <ShowPage.Row title={t("common.fields.acceleratorType")}>
              {t(
                `clusters.acceleratorTypes.${displayResources.accelerator.type}`,
                {
                  defaultValue: displayResources.accelerator.type,
                },
              )}
            </ShowPage.Row>
            <ShowPage.Row title={t("common.fields.acceleratorProduct")}>
              {displayResources.accelerator.product}
            </ShowPage.Row>
            {isVgpu && (
              <>
                <ShowPage.Row title={t("endpoints.fields.requestedVgpuMemory")}>
                  {vgpuMemory ?? "-"}
                </ShowPage.Row>
                <ShowPage.Row title={t("endpoints.fields.vgpuCorePercent")}>
                  {vgpuCorePercent}
                </ShowPage.Row>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
