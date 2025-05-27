import MetadataCard from "@/components/business/MetadataCard";
import ModelCatalogStatus from "@/components/business/ModelCatalogStatus";
import EndpointModel from "@/components/business/EndpointModel";
import JSONSchemaValueVisualizer from "@/components/business/JsonSchemaValueVisualizer";
import { ShowPage, ShowButton } from "@/components/theme";
import Loader from "@/components/theme/components/loader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ModelCatalog, Engine } from "@/types";
import { useShow, useOne } from "@refinedev/core";

export const ModelCatalogsShow = () => {
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
    return <div>404 not found</div>;
  }

  const engineVersionSchema = engineData?.data?.spec.versions.find(
    (v) => v.version === record.spec.engine.version,
  )?.values_schema;

  return (
    <ShowPage record={record} canDelete={false} canEdit={false}>
      <div className="overflow-auto h-full">
        <MetadataCard metadata={record.metadata} />

        <Card className="mt-4">
          <CardContent>
            <div className="grid grid-cols-4 gap-8">
              <ShowPage.Row title={"Status"}>
                <ModelCatalogStatus phase={record.status?.phase} />
              </ShowPage.Row>
              {record.status?.last_transition_time && (
                <ShowPage.Row title={"Last Transition"}>
                  {new Date(
                    record.status.last_transition_time,
                  ).toLocaleString()}
                </ShowPage.Row>
              )}
            </div>
            {record.status?.error_message && (
              <ShowPage.Row title={"Error Message"}>
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
              <ShowPage.Row title={"Engine"}>
                {record.spec.engine.engine}:{record.spec.engine.version}
              </ShowPage.Row>
              <div className="col-span-2">
                <ShowPage.Row title={"Model"}>
                  <EndpointModel model={record.spec.model} />
                </ShowPage.Row>
              </div>
              <ShowPage.Row title={"Task"}>
                <Badge variant="outline">{record.spec.model.task}</Badge>
              </ShowPage.Row>
            </div>
            <div className="grid grid-cols-4 gap-8">
              <ShowPage.Row title={"Registry"}>
                <ShowButton
                  recordItemId={record.spec.model.registry}
                  meta={{
                    workspace: record.metadata.workspace,
                  }}
                  variant="link"
                  resource="model_registries"
                >
                  {record.spec.model.registry}
                </ShowButton>
              </ShowPage.Row>
              <ShowPage.Row title={"Model File"}>
                {record.spec.model.file}
              </ShowPage.Row>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Resources</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-8">
              <ShowPage.Row title="GPU">
                {Object.values(record.spec.resources?.accelerator || {})[0] ??
                  record.spec.resources?.gpu ??
                  "-"}
              </ShowPage.Row>
              <ShowPage.Row title="CPU">
                {record.spec.resources?.cpu ?? "-"}
              </ShowPage.Row>
              <ShowPage.Row title="Memory">
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
              <ShowPage.Row title="Replica">
                {record.spec.replicas?.num ?? 1}
              </ShowPage.Row>
              <ShowPage.Row title="Scheduler">
                {typeof record.spec.deployment_options === "object" &&
                record.spec.deployment_options &&
                "scheduler" in record.spec.deployment_options &&
                typeof record.spec.deployment_options.scheduler === "object" &&
                record.spec.deployment_options.scheduler &&
                "type" in record.spec.deployment_options.scheduler
                  ? String(record.spec.deployment_options.scheduler.type)
                  : "Power of two"}
              </ShowPage.Row>
            </div>
          </CardContent>
        </Card>

        {engineVersionSchema && record.spec.variables && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Variables</CardTitle>
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
