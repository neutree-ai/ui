import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getVgpuMemoryDisplay,
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

  const shouldShowGpu = showGpuConditionally
    ? Boolean(resources?.gpu && resources.gpu > 0)
    : true;

  const hasAccelerator = Boolean(
    resources?.accelerator?.type && resources?.accelerator?.product,
  );
  const isVgpu = hasVgpuResources(resources);
  const vgpuMemory = getVgpuMemoryDisplay(
    resources?.accelerator?.virtualization,
    undefined,
  );

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>{t(titleTranslationKey)}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-8">
          {shouldShowGpu && (
            <ShowPage.Row title={t("common.fields.gpu")}>
              {formatToDecimal(resources?.gpu) ?? "-"}
            </ShowPage.Row>
          )}
          <ShowPage.Row title={t("common.fields.cpu")}>
            {formatToDecimal(resources?.cpu) ?? "-"}
          </ShowPage.Row>
          <ShowPage.Row title={t("common.fields.memory")}>
            {formatToDecimal(resources?.memory) ?? "-"}
          </ShowPage.Row>
        </div>

        {hasAccelerator && resources?.accelerator && (
          <div className="mt-4">
            <ShowPage.Row title={t("common.fields.acceleratorType")}>
              {t(`clusters.acceleratorTypes.${resources.accelerator.type}`, {
                defaultValue: resources.accelerator.type,
              })}
            </ShowPage.Row>
            <ShowPage.Row title={t("common.fields.acceleratorProduct")}>
              {resources.accelerator.product}
            </ShowPage.Row>
            {isVgpu && (
              <>
                <ShowPage.Row title={t("endpoints.fields.requestedVgpuMemory")}>
                  {vgpuMemory ?? "-"}
                </ShowPage.Row>
                <ShowPage.Row title={t("endpoints.fields.vgpuCorePercent")}>
                  {resources.accelerator.virtualization?.core_percent ?? "-"}%
                </ShowPage.Row>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
