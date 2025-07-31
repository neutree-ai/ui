import ImageRegistryStatus from "@/components/business/ImageRegistryStatus";
import MetadataCard from "@/components/business/MetadataCard";
import { ShowPage } from "@/components/theme";
import Loader from "@/components/theme/components/loader";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslation } from "@/lib/i18n";
import type { ImageRegistry } from "@/types";
import { useShow } from "@refinedev/core";

export const ImageRegistriesShow = () => {
  const { t } = useTranslation();
  const {
    query: { data, isLoading },
  } = useShow<ImageRegistry>();
  const record = data?.data;

  if (isLoading) {
    return <Loader className="h-4 text-primary" />;
  }

  if (!record) {
    return <div>{t("pages.error.notFound")}</div>;
  }

  return (
    <ShowPage record={record}>
      <MetadataCard metadata={record.metadata} />
      <Card className="mt-4">
        <CardContent>
          <ShowPage.Row title={t("image_registries.fields.status")}>
            <ImageRegistryStatus phase={record.status?.phase} />
          </ShowPage.Row>
          <div className="grid grid-cols-4 gap-8">
            <ShowPage.Row title={t("image_registries.fields.repo")}>
              {record.spec.url}/{record.spec.repository}
            </ShowPage.Row>
          </div>
        </CardContent>
      </Card>
    </ShowPage>
  );
};
