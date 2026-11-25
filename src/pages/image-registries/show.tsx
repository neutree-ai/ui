import { useShow } from "@refinedev/core";
import { imageRegistryConfigFields } from "@/domains/image-registry/lib/detail-fields";
import { imageRegistryPhases } from "@/domains/image-registry/lib/phases";
import type { ImageRegistry } from "@/domains/image-registry/types";
import { Loader } from "@/foundation/components/Loader";
import { useTranslation } from "@/foundation/lib/i18n";
import { PhaseStatus } from "@/foundation/role/PhaseStatus";
import { DetailFields } from "@/foundation/scene/DetailFields";
import { MetadataTimestampMeta } from "@/foundation/scene/MetadataTimestampMeta";
import { ShowPage } from "@/foundation/scene/ShowPage";

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
        status={
          <PhaseStatus status={record.status} phases={imageRegistryPhases} />
        }
        description={
          <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1">
            <MetadataTimestampMeta metadata={record.metadata} />
          </span>
        }
      />
      <div className="mt-4 space-y-3">
        <ShowPage.Section title={t("common.sections.configuration")}>
          <DetailFields fields={imageRegistryConfigFields} record={record} />
        </ShowPage.Section>
      </div>
    </ShowPage>
  );
};
