import { useShow } from "@refinedev/core";
import ImageRegistryStatus from "@/domains/image-registry/components/ImageRegistryStatus";
import type { ImageRegistry } from "@/domains/image-registry/types";
import { Loader } from "@/foundation/components/Loader";
import { MetadataTimestampMeta } from "@/foundation/components/MetadataTimestampMeta";
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

  const repository = record.spec.repository?.trim();
  const repositoryUrl = repository
    ? `${record.spec.url.replace(/\/$/, "")}/${repository.replace(/^\//, "")}`
    : record.spec.url;

  return (
    <ShowPage record={record} showCurrentBreadcrumb={false}>
      <ShowPage.ObjectHeader
        title={record.metadata.name}
        status={<ImageRegistryStatus {...record.status} />}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1">
            <MetadataTimestampMeta metadata={record.metadata} />
          </span>
        }
      />
      <div className="mt-4 space-y-3">
        <ShowPage.Section title={t("common.sections.configuration")}>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-4">
            <ShowPage.Row title={t("image_registries.fields.repo")}>
              {repositoryUrl}
            </ShowPage.Row>
          </div>
        </ShowPage.Section>
      </div>
    </ShowPage>
  );
};
