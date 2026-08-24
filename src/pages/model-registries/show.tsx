import { useParsed, useShow } from "@refinedev/core";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ModelRegistryStatus from "@/domains/model-registry/components/ModelRegistryStatus";
import ModelRegistryType from "@/domains/model-registry/components/ModelRegistryType";
import { RegistryAvailabilityNotice } from "@/domains/model-registry/components/RegistryAvailabilityNotice";
import { RegistryModelsTable } from "@/domains/model-registry/components/RegistryModelsTable";
import { RegistryVisibility } from "@/domains/model-registry/components/RegistryVisibility";
import { registryIsProvisioned } from "@/domains/model-registry/lib/provisioning";
import type { ModelRegistry } from "@/domains/model-registry/types";
import { Loader } from "@/foundation/components/Loader";
import { MetadataDisclosure } from "@/foundation/components/MetadataDisclosure";
import { MetadataTimestampMeta } from "@/foundation/components/MetadataTimestampMeta";
import { ShowPage } from "@/foundation/components/ShowPage";
import { useTranslation } from "@/foundation/lib/i18n";
import { MODEL_REGISTRY_SELECT } from "@/foundation/lib/model-registry-visibility";

const detailTabTriggerClassName =
  "relative z-10 h-full rounded-none border-0 bg-transparent px-0 py-2 text-sm font-semibold text-muted-foreground shadow-none transition-colors after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-transparent hover:bg-transparent hover:text-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none data-[state=active]:after:bg-primary data-[state=active]:hover:bg-transparent";

export const ModelRegistriesShow = () => {
  const { t } = useTranslation();
  const { params } = useParsed();
  const {
    query: { data, isLoading },
  } = useShow<ModelRegistry>({
    // `visibility` decides what this page offers, and it is a computed field —
    // absent unless it is named. See MODEL_REGISTRY_SELECT.
    meta: { select: MODEL_REGISTRY_SELECT },
  });
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

  // A provisioned registry is configured by a neutree-core setting and refuses
  // both writes, so neither control is offered. See registryIsProvisioned.
  const isProvisioned = registryIsProvisioned(record);

  return (
    <ShowPage
      record={record}
      canEdit={!isProvisioned}
      canDelete={!isProvisioned}
      showCurrentBreadcrumb={false}
    >
      <Tabs defaultValue="basic" className="flex h-full flex-col">
        <ShowPage.ObjectHeader
          title={record.metadata.name}
          status={<ModelRegistryStatus {...record.status} />}
          description={
            <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1">
              <ShowPage.Meta label={t("common.fields.type")}>
                <ModelRegistryType type={record.spec.type} />
              </ShowPage.Meta>
              {/* main (#372) replaced the inline workspace meta with the
                  created-at one; kept as it landed. Visibility is added beside
                  it rather than in place of it. */}
              <MetadataTimestampMeta metadata={record.metadata} />
              <ShowPage.Meta label={t("model_registries.fields.visibility")}>
                <RegistryVisibility visibility={record.visibility} />
              </ShowPage.Meta>
            </span>
          }
        />
        {/* Above the tabs, not inside one: an unreachable registry is the
            explanation for both an empty model list and a stale-looking
            configuration, so it should not be something you have to switch tab
            to find. */}
        <div className="mb-3 empty:hidden">
          <RegistryAvailabilityNotice workspace={workspace} registry={record} />
        </div>
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
          className="mt-0 flex-1 space-y-3 overflow-auto pt-4"
        >
          <MetadataDisclosure metadata={record.metadata} />
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
          className="mt-0 flex-1 space-y-3 overflow-auto pt-4"
        >
          <RegistryModelsTable
            workspace={workspace}
            registry={record}
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
