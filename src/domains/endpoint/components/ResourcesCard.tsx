import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  acceleratorTypeLabel,
  requestedResourcesView,
} from "@/domains/endpoint/lib/endpoint-display-summary";
import { ShowPage } from "@/foundation/scene/ShowPage";
import { EmptyValue } from "@/foundation/type/EmptyValue";
import type { ResourceSpec } from "@/foundation/types/serving-types";

interface ResourcesCardProps {
  resources: ResourceSpec | null;
  showGpuConditionally?: boolean;
  titleTranslationKey?: string;
  framed?: boolean;
  className?: string;
}

export default function ResourcesCard({
  resources,
  showGpuConditionally = false,
  titleTranslationKey = "common.fields.resources",
  framed = true,
  className,
}: ResourcesCardProps) {
  const { t } = useTranslation();
  const view = requestedResourcesView(resources);

  const content = (
    <>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {(!showGpuConditionally || view.requestsGpu) && (
          <ShowPage.Row title={t("common.fields.gpu")}>
            {view.gpu ?? <EmptyValue />}
          </ShowPage.Row>
        )}
        <ShowPage.Row title={t("common.fields.cpu")}>
          {view.cpu ?? <EmptyValue />}
        </ShowPage.Row>
        <ShowPage.Row title={t("common.fields.memory")}>
          {view.memory ?? <EmptyValue />}
        </ShowPage.Row>
      </div>

      {view.accelerator && (
        <div className="mt-5 grid gap-5 border-t pt-4 md:grid-cols-2 xl:grid-cols-4">
          <ShowPage.Row title={t("common.fields.acceleratorType")}>
            {acceleratorTypeLabel(view.accelerator.type, t)}
          </ShowPage.Row>
          <ShowPage.Row title={t("common.fields.acceleratorProduct")}>
            {view.accelerator.product}
          </ShowPage.Row>
          {view.vgpu && (
            <>
              <ShowPage.Row title={t("endpoints.fields.requestedVgpuMemory")}>
                {view.vgpu.memory ?? <EmptyValue />}
              </ShowPage.Row>
              <ShowPage.Row title={t("endpoints.fields.vgpuCorePercent")}>
                {view.vgpu.corePercent ?? <EmptyValue />}
              </ShowPage.Row>
            </>
          )}
        </div>
      )}
    </>
  );

  if (!framed) {
    return (
      <div className={className}>
        <h3 className="mb-3 text-sm font-semibold text-foreground">
          {t(titleTranslationKey)}
        </h3>
        {content}
      </div>
    );
  }

  return (
    <Card className={className ?? "mt-4"}>
      <CardHeader>
        <CardTitle>{t(titleTranslationKey)}</CardTitle>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
