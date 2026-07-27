import { useShow } from "@refinedev/core";
import { Button } from "@/components/ui/button";
import ModelRegistryStatus from "@/domains/model-registry/components/ModelRegistryStatus";
import ModelRegistryType from "@/domains/model-registry/components/ModelRegistryType";
import type { ModelRegistry } from "@/domains/model-registry/types";
import { Loader } from "@/foundation/components/Loader";
import MetadataCard from "@/foundation/components/MetadataCard";
import { ShowPage } from "@/foundation/components/ShowPage";
import { useTranslation } from "@/foundation/lib/i18n";

export const ModelRegistriesShow = () => {
  const { t } = useTranslation();
  const {
    query: { data, isLoading },
  } = useShow<ModelRegistry>();
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
        status={<ModelRegistryStatus {...record.status} />}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1">
            <ShowPage.Meta label={t("common.fields.type")}>
              <ModelRegistryType type={record.spec.type} />
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
            <ShowPage.Row title={t("common.fields.type")}>
              <ModelRegistryType type={record.spec.type} />
            </ShowPage.Row>
            <ShowPage.Row title={t("model_registries.fields.url")}>
              <a href={record.spec.url} target="_blank" rel="noreferrer">
                <Button variant="link" className="p-0">
                  {record.spec.url}
                </Button>
              </a>
            </ShowPage.Row>
          </div>
        </ShowPage.Section>
      </div>
    </ShowPage>
  );
};
