import MetadataCard from "@/components/business/MetadataCard";
import ModelCatalogStatus from "@/components/business/ModelCatalogStatus";
import EndpointModel from "@/components/business/EndpointModel";
import ModelTask from "@/components/business/ModelTask";
import JSONSchemaValueVisualizer from "@/components/business/JsonSchemaValueVisualizer";
import { ShowPage, ShowButton } from "@/components/theme";
import Loader from "@/components/theme/components/loader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ModelCatalog, Engine } from "@/types";
import { useShow, useOne } from "@refinedev/core";
import { useTranslation } from "@/lib/i18n";

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
            <div className="grid grid-cols-4 gap-8">
              <ShowPage.Row title={t("model_catalogs.fields.status")}>
                <ModelCatalogStatus phase={record.status?.phase} />
              </ShowPage.Row>
              {record.status?.last_transition_time && (
                <ShowPage.Row title={t("model_catalogs.fields.lastTransition")}>
                  {new Date(
                    record.status.last_transition_time,
                  ).toLocaleString()}
                </ShowPage.Row>
              )}
            </div>
            {record.status?.error_message && (
              <ShowPage.Row title={t("model_catalogs.fields.errorMessage")}>
                <span className="text-destructive">
                  {record.status.error_message}
                </span>
              </ShowPage.Row>
            )}
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
                  ? String(record.spec.deployment_options.scheduler.type)
                  : t("model_catalogs.values.powerOfTwo")}
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
