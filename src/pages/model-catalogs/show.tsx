import { useOne, useShow } from "@refinedev/core";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import DeploymentConfigCard from "@/domains/endpoint/components/DeploymentConfigCard";
import EndpointEngine from "@/domains/endpoint/components/EndpointEngine";
import EndpointModel from "@/domains/endpoint/components/EndpointModel";
import ModelTask from "@/domains/endpoint/components/ModelTask";
import ResourcesCard from "@/domains/endpoint/components/ResourcesCard";
import JSONSchemaValueVisualizer from "@/domains/engine/components/JsonSchemaValueVisualizer";
import type { Engine } from "@/domains/engine/types";
import ModelCatalogStatus from "@/domains/model-catalog/components/ModelCatalogStatus";
import type { ModelCatalog } from "@/domains/model-catalog/types";
import { Loader } from "@/foundation/components/Loader";
import MetadataCard from "@/foundation/components/MetadataCard";
import { ShowPage } from "@/foundation/components/ShowPage";
import { useTranslation } from "@/foundation/lib/i18n";
import { EnvCard, KeyConfigCard } from "./components/KeyConfigCard";

export const ModelCatalogsShow = () => {
  const { t } = useTranslation();
  const {
    query: { data, isLoading },
  } = useShow<ModelCatalog>({});
  const record = data?.data;
  const [advancedOpen, setAdvancedOpen] = useState(false);

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
            {record.spec.model.file && (
              <div className="grid grid-cols-4 gap-8">
                <ShowPage.Row title={t("model_catalogs.fields.modelFile")}>
                  {record.spec.model.file}
                </ShowPage.Row>
              </div>
            )}
          </CardContent>
        </Card>

        <ResourcesCard
          resources={record.spec.resources}
          titleTranslationKey="common.fields.resources"
        />

        <KeyConfigCard variables={record.spec.variables} />

        <EnvCard env={record.spec.env ?? null} />

        <DeploymentConfigCard
          replicas={record.spec.replicas}
          deploymentOptions={record.spec.deployment_options}
        />

        {engineVersionSchema && record.spec.variables && (
          <Collapsible
            open={advancedOpen}
            onOpenChange={setAdvancedOpen}
            className="mt-4"
          >
            <Card>
              <CollapsibleTrigger asChild>
                <CardContent className="cursor-pointer py-3 flex items-center gap-2 hover:bg-accent/40">
                  {advancedOpen ? (
                    <ChevronDown className="size-4" />
                  ) : (
                    <ChevronRight className="size-4" />
                  )}
                  <span className="text-sm font-medium">
                    {t("model_catalogs.sections.advanced")}
                  </span>
                </CardContent>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <JSONSchemaValueVisualizer
                    schema={engineVersionSchema as Record<string, unknown>}
                    value={record.spec.variables}
                  />
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        )}
      </div>
    </ShowPage>
  );
};
