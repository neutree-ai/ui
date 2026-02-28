import { Card, CardContent } from "@/components/ui/card";
import ImageRegistryStatus from "@/domains/image-registry/components/ImageRegistryStatus";
import type { ImageRegistry } from "@/domains/image-registry/types";
import { Loader } from "@/foundation/components/Loader";
import MetadataCard from "@/foundation/components/MetadataCard";
import { ShowPage } from "@/foundation/components/ShowPage";
import { useTranslation } from "@/foundation/lib/i18n";
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
          <ShowPage.Row title={t("common.fields.status")}>
            <ImageRegistryStatus {...record.status} />
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
