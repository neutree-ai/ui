import { useCustom, useSelect } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Combobox as AsyncCombobox } from "@/components/ui/combobox";
import { CommandLoading } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { ComposePreview } from "@/domains/endpoint/components/ComposePreview";
import { FeaturePicker } from "@/domains/endpoint/components/FeaturePicker";
import { formatTaskName } from "@/domains/endpoint/components/ModelTask";
import { SliderWithInput } from "@/domains/endpoint/components/SliderWithInput";
import { VariantPicker } from "@/domains/endpoint/components/VariantPicker";
import { VRAMCheckBadge } from "@/domains/endpoint/components/VRAMCheckBadge";
import { useEndpointClusterResources } from "@/domains/endpoint/hooks/use-endpoint-cluster-resources";
import { useEndpointEngineOptions } from "@/domains/endpoint/hooks/use-endpoint-engine-options";
import useEndpointResources from "@/domains/endpoint/hooks/use-endpoint-resources";
import {
  buildCatalogMergedSpec,
  defaultEndpointSpec,
  transformEndpointValues,
  validateEndpointValues,
} from "@/domains/endpoint/lib/endpoint-form-helpers";
import type {
  Endpoint,
  EndpointClusterRef,
  EndpointEngineRef,
  EndpointModelCatalogRef,
  EndpointModelRegistryRef,
} from "@/domains/endpoint/types";
import FormCardGrid from "@/foundation/components/FormCardGrid";
import { FormCombobox } from "@/foundation/components/FormCombobox";
import { FormFieldGroup } from "@/foundation/components/FormFieldGroup";
import { VariablesInput } from "@/foundation/components/VariablesInput";
import WorkspaceField from "@/foundation/components/WorkspaceField";
import type { Schema } from "@/foundation/hooks/use-variables-input";
import { useWorkspace } from "@/foundation/hooks/use-workspace";
import {
  composeEndpointSpec,
  defaultEnabledFeatures,
} from "@/foundation/recipe/compose";
import { DEFAULT_VARIANT, isRecipeShape } from "@/foundation/recipe/normalize";
import type { ComposedSpec, RecipeInputSpec } from "@/foundation/recipe/types";

// Reads `?model_catalog=<id>` off the current URL. The app uses a HashRouter so
// the query lives in location.hash ("#/ws/endpoints/create?model_catalog=1").
// Returns "" when absent or outside a browser (e.g. unit tests), so callers can
// treat it as "no preselection".
function readModelCatalogQueryParam(): string {
  if (typeof window === "undefined") return "";
  const hash = window.location.hash ?? "";
  const q = hash.indexOf("?");
  if (q === -1) return "";
  return new URLSearchParams(hash.slice(q + 1)).get("model_catalog") ?? "";
}

export const useEndpointForm = ({ action }: { action: "create" | "edit" }) => {
  const { t } = useTranslation();
  const { current: currentWorkspace } = useWorkspace();
  const [selectedModelCatalog, setSelectedModelCatalog] = useState<string>("");
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  // Recipe-mode state: only meaningful when the selected catalog is a Recipe MC.
  const [selectedVariant, setSelectedVariant] = useState<string>("");
  const [enabledFeatures, setEnabledFeatures] = useState<string[]>([]);

  const form = useForm<Endpoint>({
    mode: "all",
    defaultValues: {
      api_version: "v1",
      kind: "Endpoint",
      metadata: {
        name: "",
        workspace: currentWorkspace,
      },
      spec: defaultEndpointSpec,
    },
    refineCoreProps: {
      autoSave: {
        enabled: false,
      },
    },
    warnWhenUnsavedChanges: true,
    resolver: (values) => {
      transformEndpointValues(values.spec);
      const errors = validateEndpointValues(
        values.spec,
        {
          action,
          currentRegistry,
          currentModelName,
          availableModelNames: (modelsData.data?.data || []).map(
            (m: { name: string }) => m.name,
          ),
        },
        t,
      );
      return { values, errors };
    },
  });

  const formValues = form.getValues();
  // Only consider current usage in edit mode (for resources already allocated to this endpoint)
  // In create mode, the endpoint doesn't exist yet, so current usage should always be 0
  const currentUsage = useEndpointResources(
    action === "edit" ? formValues.spec?.resources : undefined,
    action === "edit" ? formValues.metadata : undefined,
  );

  const workspace = form.watch("metadata.workspace");
  const currentModelName = form.watch("spec.model.name");
  const currentRegistry = form.watch("spec.model.registry");
  const currentCluster = form.watch("spec.cluster");
  const engineSpec = form.watch("spec.engine");

  const meta = useMemo(
    () => ({
      workspace,
      workspaced: true,
    }),
    [workspace],
  );

  const engines = useSelect<EndpointEngineRef>({
    resource: "engines",
    meta,
  });

  const clusters = useSelect<EndpointClusterRef>({
    resource: "clusters",
    meta,
  });

  const modelRegistries = useSelect<EndpointModelRegistryRef>({
    resource: "model_registries",
    meta,
  });

  const modelCatalogs = useSelect<EndpointModelCatalogRef>({
    resource: "model_catalogs",
    meta,
  });

  const selectedAccelerator = form.watch("spec.resources.accelerator");
  const cpuUsage = form.watch("spec.resources.cpu");
  const memoryUsage = form.watch("spec.resources.memory");

  const {
    clusterResources,
    acceleratorOptions,
    maxAvailable,
    dynamicAvailability,
    gpuStep,
  } = useEndpointClusterResources({
    currentCluster,
    clustersData: clusters.query.data?.data,
    selectedAccelerator,
    cpuUsage,
    memoryUsage,
    currentUsage,
    t,
  });

  const isEdit = action === "edit";

  const effectiveModelSearch = modelSearch || "";

  const modelsData = useCustom({
    url: `/workspaces/${workspace}/model_registries/${currentRegistry}/models?${effectiveModelSearch ? `search=${effectiveModelSearch}` : ""}&limit=20`,
    method: "get",
    queryOptions: {
      enabled: Boolean(currentRegistry),
    },
  });

  const { engineNames, engineVersions, engineTasks, engineValueSchema } =
    useEndpointEngineOptions({
      enginesData: engines.query.data?.data,
      engineSpec,
    });

  // Set each key of obj as a separate form.setValue call, recursing into
  // nested plain objects. This ensures mounted FormField controllers get
  // notified, because useController uses useWatch with exact:true and
  // only reacts to setValue calls whose path exactly matches the field name.
  const setLeafValues = (basePath: string, obj: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(obj)) {
      const path = `${basePath}.${key}`;
      form.setValue(path as any, value);
      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        setLeafValues(path, value as Record<string, unknown>);
      }
    }
  };

  // Apply a merged catalog spec (or defaults when null) to the form.
  const applyCatalogSpec = (catalogSpec: Record<string, unknown> | null) => {
    const merged = buildCatalogMergedSpec(catalogSpec);
    for (const [key, value] of Object.entries(merged)) {
      setLeafValues(`spec.${key}`, value);
    }
  };

  // Locate the currently selected catalog (or undefined).
  const selectedCatalog = useMemo<EndpointModelCatalogRef | undefined>(
    () =>
      modelCatalogs.query.data?.data.find(
        (catalog) => catalog.id.toString() === selectedModelCatalog,
      ),
    [modelCatalogs.query.data?.data, selectedModelCatalog],
  );

  // True when the selected catalog uses the Recipe extension.
  const isRecipeCatalog = useMemo(
    () => isRecipeShape(selectedCatalog?.spec ?? null),
    [selectedCatalog],
  );

  // Live composition for Recipe MCs — used for preview and for populating the
  // legacy form fields on selection / when the user toggles features/variant.
  const composeResult = useMemo(() => {
    if (!selectedCatalog || !isRecipeCatalog) return null;
    return composeEndpointSpec(
      selectedCatalog.spec as RecipeInputSpec,
      selectedVariant,
      enabledFeatures,
    );
  }, [selectedCatalog, isRecipeCatalog, selectedVariant, enabledFeatures]);

  // Apply a composed Recipe spec onto the form. Mirrors `applyCatalogSpec`'s
  // semantics (deep-merge over defaults) but uses the ComposedSpec fields and
  // additionally writes the new ref fields (model_catalog/variant/enabled_features).
  const applyComposedToForm = (
    catalogName: string,
    variant: string,
    features: string[],
    composed: ComposedSpec,
  ) => {
    // Build a pseudo catalog spec containing only the kernel fields so we can
    // reuse buildCatalogMergedSpec's deep-merge over defaults.
    const pseudoCatalogSpec: Record<string, unknown> = {
      model: composed.model ?? undefined,
      engine: composed.engine ?? undefined,
      resources: composed.resources ?? undefined,
      variables: { engine_args: composed.engine_args ?? {} },
      env: composed.env ?? {},
    };
    const merged = buildCatalogMergedSpec(pseudoCatalogSpec);
    for (const [key, value] of Object.entries(merged)) {
      setLeafValues(`spec.${key}`, value);
    }
    // Double-write the recipe refs so the backend has the option of
    // recomposing in the future without losing the user's selection.
    form.setValue("spec.model_catalog" as any, catalogName);
    form.setValue("spec.variant" as any, variant || DEFAULT_VARIANT);
    form.setValue("spec.enabled_features" as any, features);
  };

  // Handle model catalog selection with merge logic. Trivial MCs go through
  // the original `applyCatalogSpec` path; Recipe MCs go through the composer.
  const handleModelCatalogSelect = (catalogId: string) => {
    setSelectedModelCatalog(catalogId);

    if (!catalogId) {
      applyCatalogSpec(null);
      // Clear recipe ref fields when going back to "none"
      form.setValue("spec.model_catalog" as any, "");
      form.setValue("spec.variant" as any, "");
      form.setValue("spec.enabled_features" as any, []);
      setSelectedVariant("");
      setEnabledFeatures([]);
      return;
    }

    const catalog = modelCatalogs.query.data?.data.find(
      (c) => c.id.toString() === catalogId,
    );
    if (!catalog) return;

    if (isRecipeShape(catalog.spec)) {
      // Recipe path — initialize variant/features defaults, then compose.
      const variants = Object.keys(catalog.spec.variants ?? {});
      const initialVariant = variants.includes(DEFAULT_VARIANT)
        ? DEFAULT_VARIANT
        : (variants[0] ?? DEFAULT_VARIANT);
      const initialFeatures = defaultEnabledFeatures(
        catalog.spec as RecipeInputSpec,
      );
      setSelectedVariant(initialVariant);
      setEnabledFeatures(initialFeatures);
      const result = composeEndpointSpec(
        catalog.spec as RecipeInputSpec,
        initialVariant,
        initialFeatures,
      );
      if (result.ok) {
        applyComposedToForm(
          catalog.metadata.name,
          initialVariant,
          initialFeatures,
          result.spec,
        );
      }
    } else {
      // Trivial path — current behavior, unchanged.
      applyCatalogSpec(catalog.spec as Record<string, unknown>);
      form.setValue("spec.model_catalog" as any, "");
      form.setValue("spec.variant" as any, "");
      form.setValue("spec.enabled_features" as any, []);
      setSelectedVariant("");
      setEnabledFeatures([]);
    }
  };

  // Deploy-from-catalog-card: the catalog list page links here with
  // `?model_catalog=<id>` to preselect that catalog (lightweight deploy entry —
  // no backend change, the create form just opens with the catalog chosen).
  // Read the id straight off the HashRouter URL (no refine router hook, so this
  // stays inert in unit tests that mount the hook without a router) and apply
  // once, after the catalog list has loaded and contains the id.
  const [preselectCatalogId] = useState(() =>
    action === "create" ? readModelCatalogQueryParam() : "",
  );
  const preselectAppliedRef = useRef(false);
  useEffect(() => {
    if (preselectAppliedRef.current || !preselectCatalogId) return;
    const list = modelCatalogs.query.data?.data;
    if (!list?.some((c) => c.id.toString() === preselectCatalogId)) return;
    preselectAppliedRef.current = true;
    handleModelCatalogSelect(preselectCatalogId);
    // handleModelCatalogSelect is stable enough for a one-shot guarded apply.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectCatalogId, modelCatalogs.query.data]);

  // When user changes variant or features, re-apply the composed result.
  const handleVariantChange = (v: string) => {
    setSelectedVariant(v);
    if (!selectedCatalog) return;
    const result = composeEndpointSpec(
      selectedCatalog.spec as RecipeInputSpec,
      v,
      enabledFeatures,
    );
    if (result.ok) {
      applyComposedToForm(
        selectedCatalog.metadata.name,
        v,
        enabledFeatures,
        result.spec,
      );
    }
  };

  const handleFeaturesChange = (next: string[]) => {
    setEnabledFeatures(next);
    if (!selectedCatalog) return;
    const result = composeEndpointSpec(
      selectedCatalog.spec as RecipeInputSpec,
      selectedVariant,
      next,
    );
    if (result.ok) {
      applyComposedToForm(
        selectedCatalog.metadata.name,
        selectedVariant,
        next,
        result.spec,
      );
    }
  };

  return {
    form,
    metadataFields: (
      <FormCardGrid title={t("common.sections.basicInformation")}>
        <FormFieldGroup
          {...form}
          name="metadata.name"
          label={t("common.fields.name")}
        >
          <Input
            placeholder={t("endpoints.placeholders.endpointName")}
            disabled={isEdit}
          />
        </FormFieldGroup>
        <FormFieldGroup
          {...form}
          name="metadata.workspace"
          label={t("common.fields.workspace")}
        >
          <WorkspaceField disabled={isEdit} />
        </FormFieldGroup>
      </FormCardGrid>
    ),
    // Template selection section for both create and edit modes
    templateFields: (
      <FormCardGrid
        title={
          isEdit
            ? t("endpoints.sections.configuration")
            : t("endpoints.sections.templateSelection")
        }
      >
        <FormFieldGroup
          {...form}
          name="spec.cluster"
          label={t("common.fields.cluster")}
        >
          <FormCombobox
            disabled={clusters.query.isLoading}
            placeholder={t("endpoints.placeholders.selectCluster")}
            options={(clusters.query?.data?.data || []).map((e) => {
              return {
                label: e.metadata.name,
                value: e.metadata.name,
              };
            })}
          />
        </FormFieldGroup>
        <FormFieldGroup
          {...form}
          name="spec.model.registry"
          label={t("endpoints.fields.modelRegistry")}
        >
          <FormCombobox
            placeholder={t("endpoints.placeholders.selectModelRegistry")}
            disabled={modelRegistries.query.isLoading}
            options={(modelRegistries.query.data?.data || []).map((e) => ({
              label: e.metadata.name,
              value: e.metadata.name,
            }))}
            onChange={(value) => {
              form.setValue("spec.model.registry", value as string);
              // Reset model name and search when registry changes
              form.setValue("spec.model.name", "");
              setModelSearch("");
            }}
          />
        </FormFieldGroup>
        {!isEdit && (
          <FormFieldGroup
            {...form}
            name="-model-catalog"
            label={t("endpoints.fields.modelCatalog")}
          >
            <FormCombobox
              placeholder={t("endpoints.placeholders.selectModelCatalog")}
              disabled={modelCatalogs.query.isLoading}
              options={[
                { label: t("common.options.none"), value: "" },
                ...(modelCatalogs.query.data?.data || []).map((e) => ({
                  label: e.metadata.name,
                  value: e.id.toString(),
                })),
              ]}
              value={selectedModelCatalog}
              onChange={(value) => handleModelCatalogSelect(value as string)}
            />
          </FormFieldGroup>
        )}
      </FormCardGrid>
    ),
    // Recipe selection section — shown only when the selected MC is a Recipe MC.
    // For trivial MCs this returns `null` so the existing form layout is
    // pixel-identical to before.
    recipeFields:
      !isEdit && isRecipeCatalog && selectedCatalog ? (
        <FormCardGrid title={t("endpoints.recipe.section", "Recipe options")}>
          {(() => {
            const verified = (
              selectedCatalog.metadata.annotations?.[
                "recipe.vllm.ai/hardware-verified"
              ] ?? ""
            )
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
            if (verified.length === 0) return null;
            return (
              <div className="col-span-4 flex items-center gap-2 flex-wrap text-sm">
                <span className="text-muted-foreground">
                  {t("endpoints.recipe.verifiedOn", "Verified on:")}
                </span>
                {verified.map((hw) => (
                  <Badge
                    key={hw}
                    variant="outline"
                    className="border-green-600/40 text-green-700 dark:text-green-400"
                  >
                    ✓ {hw}
                  </Badge>
                ))}
              </div>
            );
          })()}
          <FormFieldGroup
            {...form}
            name="spec.variant"
            label={t("endpoints.recipe.variant", "Variant")}
            className="col-span-2"
          >
            <VariantPicker
              variants={selectedCatalog.spec.variants ?? {}}
              value={selectedVariant}
              onChange={handleVariantChange}
            />
          </FormFieldGroup>
          {(() => {
            const v =
              selectedCatalog.spec.variants?.[selectedVariant] ??
              selectedCatalog.spec.variants?.["default"];
            const req = v?.vram_minimum_gb ?? null;
            if (!req) return null;
            return (
              <div className="col-span-4">
                <VRAMCheckBadge
                  acceleratorProduct={
                    form.watch("spec.resources.accelerator")?.product
                  }
                  gpuCount={form.watch("spec.resources.gpu")}
                  requiredGb={req}
                />
              </div>
            );
          })()}
          {selectedCatalog.spec.features &&
            Object.keys(selectedCatalog.spec.features).length > 0 && (
              <FormFieldGroup
                {...form}
                name="spec.enabled_features"
                label={t("endpoints.recipe.features", "Features")}
                className="col-span-4"
              >
                <FeaturePicker
                  features={selectedCatalog.spec.features ?? {}}
                  value={enabledFeatures}
                  onChange={handleFeaturesChange}
                />
              </FormFieldGroup>
            )}
          <div className="col-span-4">
            <ComposePreview
              composed={
                composeResult && composeResult.ok ? composeResult.spec : null
              }
              error={
                composeResult && !composeResult.ok ? composeResult.error : null
              }
            />
          </div>
        </FormCardGrid>
      ) : null,
    // Resource settings section - always visible
    resourceFields: (
      <FormCardGrid title={t("endpoints.sections.resourceSettings")}>
        <FormFieldGroup
          {...form}
          name="spec.resources.cpu"
          label={t("common.fields.cpu")}
          className="col-span-2"
        >
          <SliderWithInput
            value={form.watch("spec.resources.cpu") || 0}
            onChange={(value) => form.setValue("spec.resources.cpu", value)}
            min={0}
            max={maxAvailable.cpu.available}
            step={0.1}
            unit="cores"
            disabled={!currentCluster}
            remainingInfo={
              maxAvailable.cpu.total > 0
                ? {
                    remaining: dynamicAvailability.cpu,
                    total: maxAvailable.cpu.total,
                    label: t("endpoints.fields.remaining"),
                  }
                : undefined
            }
          />
        </FormFieldGroup>

        <FormFieldGroup
          {...form}
          name="spec.resources.memory"
          label={t("endpoints.fields.memoryGb")}
          className="col-span-2"
        >
          <SliderWithInput
            value={form.watch("spec.resources.memory") || 0}
            onChange={(value) => form.setValue("spec.resources.memory", value)}
            min={0}
            max={maxAvailable.memory.available}
            step={0.5}
            unit="GiB"
            disabled={!currentCluster}
            remainingInfo={
              maxAvailable.memory.total > 0
                ? {
                    remaining: dynamicAvailability.memory,
                    total: maxAvailable.memory.total,
                    label: t("endpoints.fields.remaining"),
                  }
                : undefined
            }
          />
        </FormFieldGroup>

        {/* Accelerator Selector */}
        <FormFieldGroup
          {...form}
          name="spec.resources.accelerator"
          label={t("endpoints.fields.accelerator")}
          className="col-span-4"
        >
          <FormCombobox
            options={acceleratorOptions.map((opt) => ({
              label: opt.label,
              value: opt.value,
            }))}
            value={
              form.watch("spec.resources.accelerator")?.type &&
              form.watch("spec.resources.accelerator")?.product
                ? `${form.watch("spec.resources.accelerator").type}:${form.watch("spec.resources.accelerator").product}`
                : ""
            }
            onChange={(value) => {
              // Parse "type:product" format
              const selectedOption = acceleratorOptions.find(
                (opt) => opt.value === value,
              );
              if (selectedOption) {
                form.setValue("spec.resources.accelerator", {
                  type: selectedOption.type,
                  product: selectedOption.product,
                });
              } else {
                form.setValue("spec.resources.accelerator", null);
              }
            }}
            placeholder={t("endpoints.placeholders.selectAccelerator")}
            disabled={!currentCluster || acceleratorOptions.length === 0}
            emptyMessage={t("endpoints.messages.noAcceleratorsAvailable")}
          />
        </FormFieldGroup>

        {/* Accelerator Count Slider */}
        {form.watch("spec.resources.accelerator")?.type &&
          form.watch("spec.resources.accelerator")?.product && (
            <FormFieldGroup
              {...form}
              name="spec.resources.gpu"
              label={t("endpoints.fields.acceleratorCount")}
              className="col-span-4"
            >
              {(() => {
                const currentGpu = form.watch("spec.resources.gpu") || 0;

                return (
                  <SliderWithInput
                    value={currentGpu}
                    onChange={(value) =>
                      form.setValue("spec.resources.gpu", value)
                    }
                    min={0}
                    max={maxAvailable.gpu.available}
                    step={gpuStep}
                    disabled={!currentCluster}
                    remainingInfo={
                      maxAvailable.gpu.total > 0
                        ? {
                            remaining: maxAvailable.gpu.available - currentGpu,
                            total: maxAvailable.gpu.total,
                            label: t("endpoints.fields.remaining"),
                          }
                        : undefined
                    }
                  />
                );
              })()}
            </FormFieldGroup>
          )}

        {/* Cluster status indicator */}
        {currentCluster && !clusterResources && (
          <div className="col-span-4 mt-2">
            <div className="text-sm text-yellow-600">
              {t("endpoints.messages.clusterResourcesUnavailable")}
            </div>
          </div>
        )}
      </FormCardGrid>
    ),
    // Collapsible customize section for both create and edit modes
    customizeFields: (
      <Collapsible open={isCustomizeOpen} onOpenChange={setIsCustomizeOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            {isEdit
              ? t("endpoints.sections.configurationDetails")
              : t("endpoints.sections.customizeSettings")}
            {isCustomizeOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 mt-4">
          <FormCardGrid title={t("endpoints.sections.modelSettings")}>
            <FormFieldGroup
              {...form}
              name="spec.model.name"
              label={t("endpoints.fields.modelName")}
            >
              <div className="space-y-2">
                <AsyncCombobox
                  placeholder={t("endpoints.placeholders.selectModel")}
                  loading={
                    modelsData.isFetching ? (
                      <CommandLoading className="px-2 py-1.5 text-muted-foreground">
                        {t("endpoints.messages.fetching")}
                      </CommandLoading>
                    ) : null
                  }
                  options={(modelsData.data?.data || []).map(
                    (e: { name: string }) => {
                      return {
                        label: e.name,
                        value: e.name,
                      };
                    },
                  )}
                  shouldFilter={false}
                  onSearchChange={setModelSearch}
                  triggerClassName="w-full"
                  // Only disable if no registry is selected
                  disabled={!currentRegistry}
                  // Show current model name
                  value={currentModelName}
                  // Handle model selection
                  onChange={(value: string) => {
                    form.setValue("spec.model.name", value);
                  }}
                />
              </div>
            </FormFieldGroup>
            <FormFieldGroup
              {...form}
              name="spec.model.version"
              label={t("endpoints.fields.modelVersion")}
            >
              <Input />
            </FormFieldGroup>
            <FormFieldGroup
              {...form}
              name="spec.model.file"
              label={t("endpoints.fields.modelFile")}
            >
              <Input />
            </FormFieldGroup>
          </FormCardGrid>

          <FormCardGrid title={t("endpoints.sections.engineSettings")}>
            <FormFieldGroup
              {...form}
              name="spec.engine.engine"
              label={t("common.fields.engine")}
            >
              <FormCombobox
                placeholder={t("endpoints.placeholders.selectEngine")}
                disabled={engines.query.isLoading}
                options={engineNames.map((v) => ({
                  label: v,
                  value: v,
                }))}
                onChange={(value) => {
                  form.setValue("spec.engine", {
                    engine: value,
                    version: engineVersions[String(value)][0].version,
                  });
                  form.setValue(
                    "spec.model.task",
                    engineTasks[String(value)][0],
                  );
                  form.trigger("spec.engine.engine");
                }}
              />
            </FormFieldGroup>
            <FormFieldGroup
              {...form}
              name="spec.engine.version"
              label={t("endpoints.fields.engineVersion")}
            >
              <FormCombobox
                placeholder={t("endpoints.placeholders.selectVersion")}
                disabled={!form.getValues().spec.engine.engine}
                options={(
                  engineVersions[form.getValues().spec.engine.engine] || []
                ).map(({ version: v }) => ({
                  label: v,
                  value: v,
                }))}
              />
            </FormFieldGroup>
            <FormFieldGroup
              {...form}
              name="spec.model.task"
              label={t("endpoints.fields.taskType")}
            >
              <FormCombobox
                placeholder={t("endpoints.placeholders.selectTaskType")}
                disabled={!form.getValues().spec.engine.engine}
                options={(
                  engineTasks[form.getValues().spec.engine.engine] || []
                ).map((v) => ({
                  label:
                    t(`models.tasks.${v}`) === `models.tasks.${v}`
                      ? formatTaskName(v)
                      : t(`models.tasks.${v}`),
                  value: v,
                }))}
              />
            </FormFieldGroup>
          </FormCardGrid>

          <FormCardGrid title={t("endpoints.sections.replicaSettings")}>
            <FormFieldGroup
              {...form}
              name="spec.replicas.num"
              label={t("endpoints.fields.replicas")}
            >
              <Input type="number" min={1} />
            </FormFieldGroup>

            <FormFieldGroup
              {...form}
              name="spec.deployment_options.scheduler.type"
              label={t("endpoints.fields.schedulerType")}
            >
              <FormCombobox
                placeholder={t("endpoints.placeholders.selectSchedulerType")}
                options={[
                  {
                    label: t("models.scheduler.roundRobin"),
                    value: "roundrobin",
                  },
                  {
                    label: t("models.scheduler.consistentHashing"),
                    value: "consistent_hash",
                  },
                ]}
              />
            </FormFieldGroup>
          </FormCardGrid>

          <FormCardGrid title={t("endpoints.sections.advancedOptions")}>
            <FormFieldGroup
              {...form}
              name="spec.variables.engine_args"
              label={t("endpoints.fields.engineVariables")}
              className="col-span-4"
            >
              <VariablesInput
                schema={engineValueSchema?.properties as unknown as Schema}
              />
            </FormFieldGroup>
            <FormFieldGroup
              {...form}
              name="spec.env"
              label={t("endpoints.fields.environment")}
              className="col-span-4"
            >
              <VariablesInput schema={{}} />
            </FormFieldGroup>
          </FormCardGrid>
        </CollapsibleContent>
      </Collapsible>
    ),
  };
};
