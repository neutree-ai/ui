import { useOne, useShow } from "@refinedev/core";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
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
import { VariantPicker } from "@/domains/endpoint/components/VariantPicker";
import JSONSchemaValueVisualizer from "@/domains/engine/components/JsonSchemaValueVisualizer";
import type { Engine } from "@/domains/engine/types";
import ModelCatalogStatus from "@/domains/model-catalog/components/ModelCatalogStatus";
import type { ModelCatalog } from "@/domains/model-catalog/types";
import { Loader } from "@/foundation/components/Loader";
import MetadataCard from "@/foundation/components/MetadataCard";
import { ShowPage } from "@/foundation/components/ShowPage";
import { useTranslation } from "@/foundation/lib/i18n";
import { isRecipeShape } from "@/foundation/recipe/normalize";
import { FeaturesList } from "./components/FeaturesList";
import { EnvCard, KeyConfigCard } from "./components/KeyConfigCard";
import { VariantTable } from "./components/VariantTable";

export const ModelCatalogsShow = () => {
  const { t } = useTranslation();
  const {
    query: { data, isLoading },
  } = useShow<ModelCatalog>({});
  const record = data?.data;
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<string>("");

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

  const isRecipe = isRecipeShape(record.spec);
  const variantEntries = isRecipe
    ? Object.entries(record.spec.variants ?? {})
    : [];
  // For Hero display in recipe mode we use the currently-selected variant.
  const heroModel = isRecipe
    ? (variantEntries.find(([k]) => k === selectedVariant)?.[1]?.model ??
      variantEntries[0]?.[1]?.model ??
      record.spec.model)
    : record.spec.model;
  const heroResources = isRecipe
    ? (variantEntries.find(([k]) => k === selectedVariant)?.[1]?.resources ??
      variantEntries[0]?.[1]?.resources ??
      record.spec.resources)
    : record.spec.resources;
  // The variant the page currently reflects (selected, or the first one).
  const activeVariantKey =
    variantEntries.find(([k]) => k === selectedVariant)?.[0] ??
    variantEntries[0]?.[0] ??
    "";
  // Advanced section for Recipe MC: union of base.engine_args + every
  // variant.engine_args + every feature.engine_args (presentation only).
  const buildRecipeAdvancedView = (): Record<string, unknown> | null => {
    if (!isRecipe) return null;
    const acc: Record<string, unknown> = {};
    Object.assign(acc, record.spec.base?.engine_args ?? {});
    for (const v of Object.values(record.spec.variants ?? {})) {
      Object.assign(acc, v?.engine_args ?? {});
    }
    for (const f of record.spec.features ?? []) {
      Object.assign(acc, f?.engine_args ?? {});
    }
    return { engine_args: acc };
  };
  const recipeAdvancedView = buildRecipeAdvancedView();

  // Verified-hardware list comes via the well-known annotation
  // `recipe.vllm.ai/hardware-verified` as a comma-separated list of
  // accelerator product names. Display-only; rendered as badges.
  const verifiedHardware = (
    record.metadata.annotations?.["recipe.vllm.ai/hardware-verified"] ?? ""
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <ShowPage record={record}>
      <div className="overflow-auto h-full">
        <MetadataCard metadata={record.metadata} />

        <Card className="mt-4">
          <CardContent>
            <ShowPage.Row title={t("common.fields.status")}>
              <ModelCatalogStatus {...record.status} />
            </ShowPage.Row>
            {verifiedHardware.length > 0 && (
              <ShowPage.Row
                title={t(
                  "model_catalogs.recipe.verifiedHardware",
                  "Verified hardware",
                )}
              >
                <div className="flex flex-wrap gap-1.5">
                  {verifiedHardware.map((hw) => (
                    <Badge
                      key={hw}
                      variant="outline"
                      className="border-green-600/40 text-green-700 dark:text-green-400"
                    >
                      ✓ {hw}
                    </Badge>
                  ))}
                </div>
              </ShowPage.Row>
            )}
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardContent>
            {isRecipe && variantEntries.length > 0 && (
              <div className="mb-5">
                <VariantPicker
                  variants={record.spec.variants ?? {}}
                  value={activeVariantKey}
                  onChange={setSelectedVariant}
                />
              </div>
            )}
            <div className="grid grid-cols-4 gap-8">
              <ShowPage.Row title={t("common.fields.engine")}>
                <EndpointEngine spec={record.spec} metadata={record.metadata} />
              </ShowPage.Row>
              <div className="col-span-2">
                <ShowPage.Row title={t("common.fields.model")}>
                  {heroModel ? (
                    <EndpointModel model={heroModel} />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </ShowPage.Row>
              </div>
              <ShowPage.Row title={t("common.fields.task")}>
                <ModelTask task={heroModel?.task ?? ""} />
              </ShowPage.Row>
            </div>
            {heroModel?.file && (
              <div className="grid grid-cols-4 gap-8">
                <ShowPage.Row title={t("model_catalogs.fields.modelFile")}>
                  {heroModel.file}
                </ShowPage.Row>
              </div>
            )}
          </CardContent>
        </Card>

        <ResourcesCard
          resources={heroResources}
          titleTranslationKey="common.fields.resources"
        />

        {isRecipe ? (
          <>
            <KeyConfigCard
              variables={{ engine_args: record.spec.base?.engine_args ?? {} }}
            />
            <EnvCard env={record.spec.base?.env ?? null} />
            <VariantTable
              variants={record.spec.variants ?? {}}
              base={record.spec.base ?? {}}
            />
            <FeaturesList features={record.spec.features ?? []} />
          </>
        ) : (
          <>
            <KeyConfigCard variables={record.spec.variables} />
            <EnvCard env={record.spec.env ?? null} />
          </>
        )}

        <DeploymentConfigCard
          replicas={record.spec.replicas}
          deploymentOptions={record.spec.deployment_options}
        />

        {engineVersionSchema &&
          (isRecipe ? recipeAdvancedView : record.spec.variables) && (
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
                      value={
                        isRecipe
                          ? (recipeAdvancedView as Record<string, unknown>)
                          : record.spec.variables
                      }
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
