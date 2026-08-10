import { useParsed, useShow } from "@refinedev/core";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ModelRegistryStatus from "@/domains/model-registry/components/ModelRegistryStatus";
import ModelRegistryType from "@/domains/model-registry/components/ModelRegistryType";
import { RegistryModelsTable } from "@/domains/model-registry/components/RegistryModelsTable";
import type { ModelRegistry } from "@/domains/model-registry/types";
import { Loader } from "@/foundation/components/Loader";
import MetadataCard from "@/foundation/components/MetadataCard";
import { ShowPage } from "@/foundation/components/ShowPage";
import { useTranslation } from "@/foundation/lib/i18n";

const detailTabTriggerClassName =
  "relative z-10 h-full rounded-none border-0 bg-transparent px-0 py-2 text-sm font-semibold text-muted-foreground shadow-none transition-colors after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-transparent hover:bg-transparent hover:text-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none data-[state=active]:after:bg-primary data-[state=active]:hover:bg-transparent";

export const ModelRegistriesShow = () => {
  const { t } = useTranslation();
  const { params } = useParsed();
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

  // The route names the workspace, so read it from there. The record's own
  // field is nullable, and defaulting it to "" would leave the models tab
  // querying nothing and silently showing an empty list — an outcome with no
  // symptom, which is the one thing worse than an error.
  const workspace = (params?.workspace as string | undefined) ?? "";

  return (
    <ShowPage record={record} showCurrentBreadcrumb={false}>
      <Tabs defaultValue="basic" className="flex h-full flex-col">
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
        <TabsList className="relative mt-0 h-11 w-full items-end justify-start gap-8 rounded-none border-0 bg-transparent p-0 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-border">
          <TabsTrigger value="basic" className={detailTabTriggerClassName}>
            {t("common.tabs.basic")}
          </TabsTrigger>
          <TabsTrigger value="models" className={detailTabTriggerClassName}>
            {t("model_registries.tabs.models")}
          </TabsTrigger>
        </TabsList>
        <TabsContent
          value="basic"
          className="mt-0 flex-1 space-y-4 overflow-auto pt-4"
        >
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
        </TabsContent>
        <TabsContent
          value="models"
          className="mt-0 flex-1 space-y-4 overflow-auto pt-4"
        >
          <RegistryModelsTable
            workspace={workspace}
            registry={record.metadata.name}
            modelHref={(model, version) =>
              `/${workspace}/model-registries/show/${encodeURIComponent(
                record.metadata.name,
              )}/models/${encodeURIComponent(
                model,
              )}?version=${encodeURIComponent(version)}`
            }
          />
        </TabsContent>
      </Tabs>
    </ShowPage>
  );
};
