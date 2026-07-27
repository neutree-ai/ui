import { useShow } from "@refinedev/core";
import ImageRegistryStatus from "@/domains/image-registry/components/ImageRegistryStatus";
import type { ImageRegistry } from "@/domains/image-registry/types";
import { Loader } from "@/foundation/components/Loader";
import MetadataCard from "@/foundation/components/MetadataCard";
import { ShowPage } from "@/foundation/components/ShowPage";
import { useTranslation } from "@/foundation/lib/i18n";

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
    <ShowPage record={record} showCurrentBreadcrumb={false}>
      <ShowPage.ObjectHeader
        title={record.metadata.name}
        status={<ImageRegistryStatus {...record.status} />}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1">
            <ShowPage.Meta label={t("image_registries.fields.repository")}>
              {record.spec.repository}
            </ShowPage.Meta>
            <ShowPage.Meta label={t("common.fields.workspace")}>
              {record.metadata.workspace ?? "-"}
            </ShowPage.Meta>
          </span>
        }
      />
      <div className="mt-4 space-y-4">
        <MetadataCard metadata={record.metadata} showName={false} />
        <ShowPage.Section title={t("common.sections.configuration")}>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-4">
            <ShowPage.Row title={t("image_registries.fields.repo")}>
              {record.spec.url}/{record.spec.repository}
            </ShowPage.Row>
          </div>
        </ShowPage.Section>
      </div>
    </ShowPage>
  );
};
