import DeploymentConfigCard from "@/components/business/DeploymentConfigCard";
import EndpointEngine from "@/components/business/EndpointEngine";
import EndpointModel from "@/components/business/EndpointModel";
import EngineVariablesCard from "@/components/business/EngineVariablesCard";
import MetadataCard from "@/components/business/MetadataCard";
import ModelCatalogStatus from "@/components/business/ModelCatalogStatus";
import ModelTask from "@/components/business/ModelTask";
import ResourcesCard from "@/components/business/ResourcesCard";
import { ShowPage } from "@/components/theme";
import Loader from "@/components/theme/components/loader";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslation } from "@/lib/i18n";
import type { Engine, ModelCatalog } from "@/types";
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
            <ShowPage.Row title={t("model_catalogs.fields.status")}>
              <ModelCatalogStatus {...record.status} />
            </ShowPage.Row>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardContent>
            <div className="grid grid-cols-4 gap-8">
              <ShowPage.Row title={t("model_catalogs.fields.engine")}>
                <EndpointEngine spec={record.spec} metadata={record.metadata} />
              </ShowPage.Row>
              <div className="col-span-2">
                <ShowPage.Row title={t("model_catalogs.fields.model")}>
                  <EndpointModel model={record.spec.model} />
                </ShowPage.Row>
              </div>
              <ShowPage.Row title={t("model_catalogs.fields.task")}>
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
          titleTranslationKey="model_catalogs.fields.resources"
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
