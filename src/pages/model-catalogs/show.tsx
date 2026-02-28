import { Card, CardContent } from "@/components/ui/card";
import DeploymentConfigCard from "@/domains/endpoint/components/DeploymentConfigCard";
import EndpointEngine from "@/domains/endpoint/components/EndpointEngine";
import EndpointModel from "@/domains/endpoint/components/EndpointModel";
import ModelTask from "@/domains/endpoint/components/ModelTask";
import ResourcesCard from "@/domains/endpoint/components/ResourcesCard";
import EngineVariablesCard from "@/domains/engine/components/EngineVariablesCard";
import type { Engine } from "@/domains/engine/types";
import ModelCatalogStatus from "@/domains/model-catalog/components/ModelCatalogStatus";
import type { ModelCatalog } from "@/domains/model-catalog/types";
import { Loader } from "@/foundation/components/Loader";
import MetadataCard from "@/foundation/components/MetadataCard";
import { ShowPage } from "@/foundation/components/ShowPage";
import { useTranslation } from "@/foundation/lib/i18n";
import { useOne, useShow } from "@refinedev/core";

export const ModelCatalogsShow = () => {
  const { t } = useTranslation();
  const {
    query: { data, isLoading },
  } = useShow<ModelCatalog>({});
  const record = data?.data;

  const { data: engineData } = useOne<Engine>({
    resource: "engines",
    id: record?.spec.engine.engine,
    queryOptions: {
      enabled: Boolean(record?.spec.engine.engine),
    },
  });

  if (isLoading) {
    return <Loader className="h-4 text-primary" />;
  }

  if (!record) {
    return <div>{t("pages.error.notFound")}</div>;
  }

  const engineVersionSchema = engineData?.data?.spec.versions.find(
    (v) => v.version === record.spec.engine.version,
  )?.values_schema;

  return (
    <ShowPage record={record} canEdit={false}>
      <div className="overflow-auto h-full">
        <MetadataCard metadata={record.metadata} />

        <Card className="mt-4">
          <CardContent>
            <ShowPage.Row title={t("common.fields.status")}>
              <ModelCatalogStatus {...record.status} />
            </ShowPage.Row>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardContent>
            <div className="grid grid-cols-4 gap-8">
              <ShowPage.Row title={t("common.fields.engine")}>
                <EndpointEngine spec={record.spec} metadata={record.metadata} />
              </ShowPage.Row>
              <div className="col-span-2">
                <ShowPage.Row title={t("common.fields.model")}>
                  <EndpointModel model={record.spec.model} />
                </ShowPage.Row>
              </div>
              <ShowPage.Row title={t("common.fields.task")}>
                <ModelTask task={record.spec.model.task} />
              </ShowPage.Row>
            </div>
            <div className="grid grid-cols-4 gap-8">
              <ShowPage.Row title={t("model_catalogs.fields.modelFile")}>
                {record.spec.model.file}
              </ShowPage.Row>
            </div>
          </CardContent>
        </Card>

        <ResourcesCard
          resources={record.spec.resources}
          titleTranslationKey="common.fields.resources"
        />

        <DeploymentConfigCard
          replicas={record.spec.replicas}
          deploymentOptions={record.spec.deployment_options}
        />

        <EngineVariablesCard
          schema={engineVersionSchema}
          variables={record.spec.variables}
        />
      </div>
    </ShowPage>
  );
};
