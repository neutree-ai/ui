import FormCardGrid from "@/components/business/FormCardGrid";
import { formatTaskName } from "@/components/business/ModelTask";
import VariablesInput from "@/components/business/VariablesInput";
import WorkspaceField from "@/components/business/WorkspaceField";
import type { Schema } from "@/components/business/use-variables-input";
import { Combobox, Field } from "@/components/theme";
import { useWorkspace } from "@/components/theme/hooks";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Combobox as AsyncCombobox } from "@/components/ui/combobox";
import { CommandLoading } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import useEndpointResources from "@/hooks/use-endpoint-resources";
import { formatToDecimal } from "@/lib/unit";
import type {
  Cluster,
  Endpoint,
  Engine,
  EngineVersion,
  GeneralModel,
  ModelCatalog,
  ModelRegistry,
} from "@/types";
import { useCustom, useSelect } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

// Types for cluster resources
type ClusterResourceSummary = {
  cpu: { available: number; total: number };
  memory: { available: number; total: number }; // in GiB
};

type AcceleratorOption = {
  label: string; // Display label: "NVIDIA GPU - Tesla-V100"
  value: string; // Unique value: "nvidia_gpu:Tesla-V100"
  type: string; // Accelerator type: "nvidia_gpu"
  product: string; // Product name: "Tesla-V100"
  available: number;
  total: number;
};

// Deep merge function for form data with smart overriding
const deepMerge = (
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> => {
  if (source === null || source === undefined) return target;
  if (target === null || target === undefined) return source;

  if (typeof source !== "object" || typeof target !== "object") {
    return source;
  }

  const result = { ...target };

  for (const key of Object.keys(source)) {
    const sourceValue = source[key];
    if (sourceValue === null || sourceValue === undefined) {
      continue; // Skip null/undefined values from source
    }

    const targetValue = target[key];

    // Special handling for nested objects
    if (
      typeof sourceValue === "object" &&
      typeof targetValue === "object" &&
      !Array.isArray(sourceValue) &&
      !Array.isArray(targetValue)
    ) {
      result[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>,
      );
    } else {
      result[key] = sourceValue;
    }
  }

  return result;
};

// Helper function to parse cluster resources from cluster.status.resource_info
const parseClusterResources = (
  cluster: Cluster | undefined,
  t: (key: string, options?: { defaultValue?: string }) => string,
): {
  summary: ClusterResourceSummary | null;
  acceleratorOptions: AcceleratorOption[];
} => {
  if (!cluster?.status?.resource_info) {
    return { summary: null, acceleratorOptions: [] };
  }

  const resourceInfo = cluster.status.resource_info;
  const allocatable = resourceInfo.allocatable;
  const available = resourceInfo.available;

  if (!allocatable || !available) {
    return { summary: null, acceleratorOptions: [] };
  }

  const summary: ClusterResourceSummary = {
    cpu: {
      available: available.cpu || 0,
      total: allocatable.cpu || 0,
    },
    memory: {
      available: available.memory || 0,
      total: allocatable.memory || 0,
    },
  };

  // Build accelerator options from accelerator_groups
  const acceleratorOptions: AcceleratorOption[] = [];

  if (allocatable.accelerator_groups) {
    for (const [type, allocatableGroup] of Object.entries(
      allocatable.accelerator_groups,
    )) {
      const availableGroup = available.accelerator_groups?.[type];
      const availableQuantity = availableGroup?.quantity || 0;
      const totalQuantity = allocatableGroup.quantity || 0;

      // Get translated type name
      const translatedType = t(`clusters.acceleratorTypes.${type}`, {
        defaultValue: type,
      });

      if (allocatableGroup.product_groups) {
        // Create an option for each product
        for (const [product, productTotal] of Object.entries(
          allocatableGroup.product_groups,
        )) {
          const productAvailable =
            availableGroup?.product_groups?.[product] || 0;

          acceleratorOptions.push({
            label: `${translatedType} - ${product}`,
            value: `${type}:${product}`,
            type,
            product,
            available: productAvailable,
            total: productTotal,
          });
        }
      } else {
        // No product breakdown, create a generic option
        acceleratorOptions.push({
          label: translatedType,
          value: `${type}:generic`,
          type,
          product: "",
          available: availableQuantity,
          total: totalQuantity,
        });
      }
    }
  }

  return { summary, acceleratorOptions };
};

export const useEndpointForm = ({ action }: { action: "create" | "edit" }) => {
  const { t } = useTranslation();
  const { current: currentWorkspace } = useWorkspace();
  const [selectedModelCatalog, setSelectedModelCatalog] = useState<string>("");
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [modelSearch, setModelSearch] = useState("");

  const form = useForm<Endpoint>({
    mode: "all",
    defaultValues: {
      api_version: "v1",
      kind: "Endpoint",
      metadata: {
        name: "",
        workspace: currentWorkspace,
      },
      spec: {
        cluster: "",
        model: {
          name: "",
          version: "",
          registry: "",
          file: "",
          task: "",
        },
        engine: {
          engine: "",
          version: "",
        },
        resources: {
          cpu: 0,
          memory: 0,
          gpu: null,
          accelerator: null,
        },
        replicas: {
          num: 1,
        },
        deployment_options: {
          scheduler: {
            type: "consistent_hash",
          },
        },
        variables: {
          engine_args: {},
        },
        env: {},
      },
    },
    refineCoreProps: {
      autoSave: {
        enabled: false,
      },
    },
    warnWhenUnsavedChanges: true,
    resolver: (values) => {
      const errors: Record<string, unknown> = {};

      if (action === "create" && currentRegistry && currentModelName) {
        const modelExists =
          modelsData.data?.data.some(
            (model: GeneralModel) => model.name === currentModelName,
          ) ?? false;

        if (!modelExists) {
          errors["-model-catalog"] = {
            type: "manual",
            message: t("endpoints.messages.modelNotFoundInRegistry"),
          };
        }
      }

      return {
        values,
        errors,
      };
    },
  });

  const formValues = form.getValues();
  const currentUsage = useEndpointResources(
    formValues.spec?.resources,
    formValues.metadata,
  );

  const workspace = form.watch("metadata.workspace");
  const currentModelName = form.watch("spec.model.name");
  const currentRegistry = form.watch("spec.model.registry");
  const currentCluster = form.watch("spec.cluster");
  const engineSpec = form.watch("spec.engine");

  const meta = useMemo(
    () => ({
      workspace,
    }),
    [workspace],
  );

  const engines = useSelect<Engine>({
    resource: "engines",
    meta,
  });

  const clusters = useSelect<Cluster>({
    resource: "clusters",
    meta,
  });

  const modelRegistries = useSelect<ModelRegistry>({
    resource: "model_registries",
    meta,
  });

  const modelCatalogs = useSelect<ModelCatalog>({
    resource: "model_catalogs",
    meta,
  });

  // Get the selected cluster object
  const selectedCluster = useMemo(() => {
    if (!currentCluster || !clusters.query.data?.data) {
      return undefined;
    }
    return clusters.query.data?.data.find(
      (opt) => opt.metadata.name === currentCluster,
    ) as unknown as Cluster | undefined;
  }, [currentCluster, clusters.query.data?.data]);

  // Parse cluster resources from cluster.status.resource_info
  const { summary: clusterResources, acceleratorOptions } = useMemo(() => {
    return parseClusterResources(selectedCluster, t);
  }, [selectedCluster, t]);

  const maxAvailable = useMemo(() => {
    if (!clusterResources) {
      return { cpu: 0, memory: 0 };
    }

    return {
      cpu:
        Number(clusterResources.cpu?.available || 0) +
        Number(currentUsage.cpu || 0),
      memory:
        Number(clusterResources.memory?.available || 0) +
        Number(currentUsage.memory || 0),
    };
  }, [clusterResources, currentUsage]);

  // Watch form values outside the useMemo to avoid dependency issues
  const cpuUsage = form.watch("spec.resources.cpu");
  const memoryUsage = form.watch("spec.resources.memory");

  const dynamicAvailability = useMemo(() => {
    const currentCpu = cpuUsage || 0;
    const currentMemory = memoryUsage || 0;
    return {
      cpu: maxAvailable.cpu - currentCpu,
      memory: maxAvailable.memory - currentMemory,
    };
  }, [maxAvailable, cpuUsage, memoryUsage]);

  const isEdit = action === "edit";

  const effectiveModelSearch = modelSearch || currentModelName || "";

  const modelsData = useCustom({
    url: `/workspaces/${workspace}/model_registries/${currentRegistry}/models?${effectiveModelSearch ? `search=${effectiveModelSearch}` : ""}&limit=20`,
    method: "get",
    queryOptions: {
      enabled: Boolean(currentRegistry),
    },
  });

  const { engineNames, engineVersions, engineTasks } = useMemo(() => {
    const engineNames: string[] = [];
    const engineVersions: Record<string, EngineVersion[]> = {};
    const engineTasks: Record<string, string[]> = {};

    for (const engine of engines.query.data?.data || []) {
      engineNames.push(engine.metadata.name);
      engineVersions[engine.metadata.name] = engine.spec.versions;
      engineTasks[engine.metadata.name] = engine.spec.supported_tasks;
    }

    return {
      engineNames,
      engineVersions,
      engineTasks,
    };
  }, [engines.query.data?.data]);

  const engineValueSchema = useMemo(() => {
    return engineSpec.engine
      ? engineVersions[engineSpec.engine]?.find(
          (v) => v.version === engineSpec.version,
        )?.values_schema
      : undefined;
  }, [engineSpec.engine, engineSpec.version, engineVersions]);

  // Handle model catalog selection with merge logic
  const handleModelCatalogSelect = (catalogId: string) => {
    setSelectedModelCatalog(catalogId);

    const selectedCatalog = modelCatalogs.query.data?.data.find(
      (catalog) => catalog.id.toString() === catalogId,
    );

    if (selectedCatalog) {
      const currentFormData = form.getValues();

      // Merge model catalog template data with current form data
      const mergedModel = deepMerge(
        currentFormData.spec.model as Record<string, unknown>,
        selectedCatalog.spec.model as Record<string, unknown>,
      );
      const mergedEngine = deepMerge(
        currentFormData.spec.engine as Record<string, unknown>,
        selectedCatalog.spec.engine as Record<string, unknown>,
      );
      const mergedResources = selectedCatalog.spec.resources
        ? deepMerge(
            currentFormData.spec.resources as Record<string, unknown>,
            selectedCatalog.spec.resources as Record<string, unknown>,
          )
        : currentFormData.spec.resources;
      const mergedReplicas = selectedCatalog.spec.replicas
        ? deepMerge(
            currentFormData.spec.replicas as Record<string, unknown>,
            selectedCatalog.spec.replicas as Record<string, unknown>,
          )
        : currentFormData.spec.replicas;

      form.setValue(
        "spec.model",
        mergedModel as typeof currentFormData.spec.model,
      );
      form.setValue(
        "spec.engine",
        mergedEngine as typeof currentFormData.spec.engine,
      );
      form.setValue(
        "spec.resources",
        mergedResources as typeof currentFormData.spec.resources,
      );
      form.setValue(
        "spec.replicas",
        mergedReplicas as typeof currentFormData.spec.replicas,
      );

      if (selectedCatalog.spec.deployment_options) {
        const mergedDeploymentOptions = deepMerge(
          currentFormData.spec.deployment_options as Record<string, unknown>,
          selectedCatalog.spec.deployment_options as Record<string, unknown>,
        );
        form.setValue(
          "spec.deployment_options",
          mergedDeploymentOptions as typeof currentFormData.spec.deployment_options,
        );
      }

      if (selectedCatalog.spec.variables) {
        const mergedVariables = deepMerge(
          currentFormData.spec.variables as Record<string, unknown>,
          selectedCatalog.spec.variables as Record<string, unknown>,
        );
        form.setValue(
          "spec.variables",
          mergedVariables as typeof currentFormData.spec.variables,
        );
      }
    }
  };

  return {
    form,
    metadataFields: (
      <FormCardGrid title={t("endpoints.sections.basicInformation")}>
        <Field
          {...form}
          name="metadata.name"
          label={t("endpoints.fields.name")}
        >
          <Input
            placeholder={t("endpoints.placeholders.endpointName")}
            disabled={isEdit}
          />
        </Field>
        <Field
          {...form}
          name="metadata.workspace"
          label={t("endpoints.fields.workspace")}
        >
          <WorkspaceField disabled={isEdit} />
        </Field>
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
        <Field
          {...form}
          name="spec.cluster"
          label={t("endpoints.fields.cluster")}
        >
          <Combobox
            disabled={clusters.query.isLoading}
            placeholder={t("endpoints.placeholders.selectCluster")}
            options={(clusters.query?.data?.data || []).map((e) => {
              return {
                label: e.metadata.name,
                value: e.metadata.name,
              };
            })}
          />
        </Field>
        <Field
          {...form}
          name="spec.model.registry"
          label={t("endpoints.fields.modelRegistry")}
        >
          <Combobox
            placeholder={t("endpoints.placeholders.selectModelRegistry")}
            disabled={modelRegistries.query.isLoading}
            options={(modelRegistries.query.data?.data || []).map((e) => ({
              label: e.metadata.name,
              value: e.metadata.name,
            }))}
            onChange={(value) => {
              form.setValue("spec.model.registry", value as string);
              // Reset model search and catalog selection when registry changes
              setModelSearch("");
            }}
          />
        </Field>
        {!isEdit && (
          <Field
            {...form}
            name="-model-catalog"
            label={t("endpoints.fields.modelCatalog")}
          >
            <Combobox
              placeholder={t("endpoints.placeholders.selectModelCatalog")}
              disabled={modelCatalogs.query.isLoading}
              options={(modelCatalogs.query.data?.data || []).map((e) => ({
                label: e.metadata.name,
                value: e.id.toString(),
              }))}
              value={selectedModelCatalog}
              onChange={(value) => handleModelCatalogSelect(value as string)}
            />
          </Field>
        )}
      </FormCardGrid>
    ),
    // Resource settings section - always visible
    resourceFields: (
      <FormCardGrid title={t("endpoints.sections.resourceSettings")}>
        <Field
          {...form}
          name="spec.resources.cpu"
          label={t("endpoints.fields.cpu")}
          className="col-span-2"
        >
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>
                {formatToDecimal(form.watch("spec.resources.cpu"))} cores
              </span>
              {clusterResources && (
                <span>
                  {t("endpoints.fields.remaining")}:{" "}
                  {formatToDecimal(dynamicAvailability.cpu)} /{" "}
                  {formatToDecimal(clusterResources.cpu.total)}
                </span>
              )}
            </div>
            <Slider
              min={0}
              max={maxAvailable.cpu}
              step={0.1}
              value={[form.watch("spec.resources.cpu")]}
              onValueChange={(value) =>
                form.setValue("spec.resources.cpu", value[0])
              }
              disabled={!currentCluster}
            />
          </div>
        </Field>

        <Field
          {...form}
          name="spec.resources.memory"
          label={t("endpoints.fields.memoryGb")}
          className="col-span-2"
        >
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>
                {formatToDecimal(form.watch("spec.resources.memory"))} GiB
              </span>
              {clusterResources && (
                <span>
                  Remaining: {formatToDecimal(dynamicAvailability.memory)} /{" "}
                  {formatToDecimal(clusterResources.memory.total)} GiB
                </span>
              )}
            </div>
            <Slider
              min={0}
              max={maxAvailable.memory}
              step={0.5}
              value={[form.watch("spec.resources.memory")]}
              onValueChange={(value) => {
                form.setValue("spec.resources.memory", value[0]);
              }}
              disabled={!currentCluster}
            />
          </div>
        </Field>

        {/* Accelerator Selector */}
        <Field
          {...form}
          name="spec.resources.accelerator"
          label={t("endpoints.fields.accelerator")}
          className="col-span-4"
        >
          <Combobox
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
            disabled={
              isEdit || !currentCluster || acceleratorOptions.length === 0
            }
            emptyMessage={t("endpoints.messages.noAcceleratorsAvailable")}
          />
        </Field>

        {/* GPU Count Slider */}
        {form.watch("spec.resources.accelerator")?.type &&
          form.watch("spec.resources.accelerator")?.product && (
            <Field
              {...form}
              name="spec.resources.gpu"
              label={t("endpoints.fields.gpuCount")}
              className="col-span-4"
            >
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>
                    {formatToDecimal(form.watch("spec.resources.gpu") || 0)}
                  </span>
                  {(() => {
                    const accelerator = form.watch(
                      "spec.resources.accelerator",
                    );
                    if (!accelerator?.type || !accelerator?.product)
                      return null;
                    const selectedValue = `${accelerator.type}:${accelerator.product}`;
                    const selectedAccelerator = acceleratorOptions.find(
                      (opt) => opt.value === selectedValue,
                    );
                    if (selectedAccelerator) {
                      const currentGpu = form.watch("spec.resources.gpu") || 0;
                      const remaining =
                        selectedAccelerator.available - currentGpu;
                      return (
                        <span>
                          {t("endpoints.fields.remaining")}:{" "}
                          {formatToDecimal(remaining)} /{" "}
                          {formatToDecimal(selectedAccelerator.total)}
                        </span>
                      );
                    }
                    return null;
                  })()}
                </div>
                <Slider
                  min={0}
                  max={(() => {
                    const accelerator = form.watch(
                      "spec.resources.accelerator",
                    );
                    if (!accelerator?.type || !accelerator?.product) return 0;
                    const selectedValue = `${accelerator.type}:${accelerator.product}`;
                    const selectedAccelerator = acceleratorOptions.find(
                      (opt) => opt.value === selectedValue,
                    );
                    return selectedAccelerator?.available || 0;
                  })()}
                  step={0.1}
                  value={[form.watch("spec.resources.gpu") || 0]}
                  onValueChange={(value) => {
                    form.setValue("spec.resources.gpu", value[0]);
                  }}
                  disabled={!currentCluster}
                />
              </div>
            </Field>
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
            <Field
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
                    (e: GeneralModel) => {
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
            </Field>
            <Field
              {...form}
              name="spec.model.version"
              label={t("endpoints.fields.modelVersion")}
            >
              <Input />
            </Field>
            <Field
              {...form}
              name="spec.model.file"
              label={t("endpoints.fields.modelFile")}
            >
              <Input />
            </Field>
          </FormCardGrid>

          <FormCardGrid title={t("endpoints.sections.engineSettings")}>
            <Field
              {...form}
              name="spec.engine.engine"
              label={t("endpoints.fields.engine")}
            >
              <Combobox
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
            </Field>
            <Field
              {...form}
              name="spec.engine.version"
              label={t("endpoints.fields.engineVersion")}
            >
              <Combobox
                placeholder={t("endpoints.placeholders.selectVersion")}
                disabled={!form.getValues().spec.engine.engine}
                options={(
                  engineVersions[form.getValues().spec.engine.engine] || []
                ).map(({ version: v }) => ({
                  label: v,
                  value: v,
                }))}
              />
            </Field>
            <Field
              {...form}
              name="spec.model.task"
              label={t("endpoints.fields.taskType")}
            >
              <Combobox
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
            </Field>
          </FormCardGrid>

          <FormCardGrid title={t("endpoints.sections.replicaSettings")}>
            <Field
              {...form}
              name="spec.replicas.num"
              label={t("endpoints.fields.replicas")}
            >
              <Input type="number" />
            </Field>

            <Field
              {...form}
              name="spec.deployment_options.scheduler.type"
              label={t("endpoints.fields.schedulerType")}
            >
              <Combobox
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
            </Field>
          </FormCardGrid>

          <FormCardGrid title={t("endpoints.sections.advancedOptions")}>
            <Field
              {...form}
              name="spec.variables.engine_args"
              label={t("endpoints.fields.engineVariables")}
              className="col-span-4"
            >
              <VariablesInput
                schema={engineValueSchema?.properties as unknown as Schema}
              />
            </Field>
            <Field
              {...form}
              name="spec.env"
              label={t("endpoints.fields.environment")}
              className="col-span-4"
            >
              <VariablesInput schema={{}} />
            </Field>
          </FormCardGrid>
        </CollapsibleContent>
      </Collapsible>
    ),
  };
};
