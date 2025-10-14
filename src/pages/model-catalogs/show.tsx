import EndpointModel from "@/components/business/EndpointModel";
import JSONSchemaValueVisualizer from "@/components/business/JsonSchemaValueVisualizer";
import MetadataCard from "@/components/business/MetadataCard";
import ModelCatalogStatus from "@/components/business/ModelCatalogStatus";
import ModelTask from "@/components/business/ModelTask";
import { ShowButton, ShowPage } from "@/components/theme";
import Loader from "@/components/theme/components/loader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
                {record.spec.engine.engine}:{record.spec.engine.version}
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

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>{t("model_catalogs.fields.resources")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-8">
              <ShowPage.Row title={t("model_catalogs.fields.gpu")}>
                {Object.values(record.spec.resources?.accelerator || {})[0] ??
                  record.spec.resources?.gpu ??
                  "-"}
              </ShowPage.Row>
              <ShowPage.Row title={t("model_catalogs.fields.cpu")}>
                {record.spec.resources?.cpu ?? "-"}
              </ShowPage.Row>
              <ShowPage.Row title={t("model_catalogs.fields.memory")}>
                {record.spec.resources?.memory ?? "-"}
              </ShowPage.Row>
            </div>

            {record.spec.resources?.accelerator && (
              <ShowPage.Row
                title={Object.keys(record.spec.resources?.accelerator)[0]}
              >
                {Object.values(record.spec.resources.accelerator)[0] ?? "-"}
              </ShowPage.Row>
            )}
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardContent>
            <div className="grid grid-cols-4 gap-8">
              <ShowPage.Row title={t("model_catalogs.fields.replica")}>
                {record.spec.replicas?.num ?? 1}
              </ShowPage.Row>
              <ShowPage.Row title={t("model_catalogs.fields.scheduler")}>
                {typeof record.spec.deployment_options === "object" &&
                record.spec.deployment_options &&
                "scheduler" in record.spec.deployment_options &&
                typeof record.spec.deployment_options.scheduler === "object" &&
                record.spec.deployment_options.scheduler &&
                "type" in record.spec.deployment_options.scheduler
                  ? record.spec.deployment_options.scheduler.type ===
                    "consistent_hash"
                    ? t("models.scheduler.consistentHashing")
                    : record.spec.deployment_options.scheduler.type ===
                        "powerOfTwo"
                      ? t("models.scheduler.powerOfTwo")
                      : String(record.spec.deployment_options.scheduler.type)
                  : t("models.scheduler.unavailable")}
              </ShowPage.Row>
            </div>
          </CardContent>
        </Card>

        {engineVersionSchema && record.spec.variables && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>{t("model_catalogs.fields.variables")}</CardTitle>
            </CardHeader>
            <CardContent>
              <JSONSchemaValueVisualizer
                schema={engineVersionSchema}
                value={record.spec.variables}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </ShowPage>
  );
};
