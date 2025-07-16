import { useForm } from "@refinedev/react-hook-form";
import { Combobox, Field } from "@/components/theme";
import type {
  Cluster,
  Endpoint,
  Engine,
  EngineVersion,
  GeneralModel,
  ModelRegistry,
  ModelCatalog,
} from "@/types";
import FormCardGrid from "@/components/business/FormCardGrid";
import { Input } from "@/components/ui/input";
import { Combobox as AsyncCombobox } from "@/components/ui/combobox";
import { useWorkspace } from "@/components/theme/hooks";
import { useCustom, useSelect } from "@refinedev/core";
import { useMemo, useState } from "react";
import WorkspaceField from "@/components/business/WorkspaceField";
import { CommandLoading } from "@/components/ui/command";
import { Slider } from "@/components/ui/slider";
import VariablesInput, {
  type Schema,
} from "@/components/business/VariablesInput";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatToDecimal } from "@/lib/utils";

// Types for Ray cluster status API response
type RayClusterResourceUsage = {
  usage: Record<string, [number, number]>; // [used, total]
  usageByNode: Record<string, Record<string, [number, number]>>;
};

type RayClusterStatus = {
  result: boolean;
  msg: string;
  data: {
    clusterStatus: {
      loadMetricsReport: RayClusterResourceUsage;
    };
  };
};

type ClusterResources = {
  cpu: { available: number; total: number };
  memory: { available: number; total: number }; // in GiB
  gpu: { available: number; total: number };
  npu: { available: number; total: number };
  acceleratorTypes: Array<{
    label: string;
    value: string;
    available: number;
    total: number;
    type: string;
  }>;
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

const resourceMapping: Record<
  string,
  { label: string; apiValue: string; type: "gpu" | "npu" }
> = {
  NVIDIAA10040G: {
    label: "NVIDIA A100 40G",
    apiValue: "NVIDIA_A100_40G",
    type: "gpu",
  },
  NVIDIAA10080G: {
    label: "NVIDIA A100 80G",
    apiValue: "NVIDIA_A100_80G",
    type: "gpu",
  },
  NVIDIATeslaV100: {
    label: "NVIDIA TESLA V100",
    apiValue: "NVIDIA_TESLA_V100",
    type: "gpu",
  },
  NVIDIATeslaP100: {
    label: "NVIDIA TESLA P100",
    apiValue: "NVIDIA_TESLA_P100",
    type: "gpu",
  },
  NVIDIATeslaT4: {
    label: "NVIDIA TESLA T4",
    apiValue: "NVIDIA_TESLA_T4",
    type: "gpu",
  },
  NVIDIATeslaP4: {
    label: "NVIDIA TESLA P4",
    apiValue: "NVIDIA_TESLA_P4",
    type: "gpu",
  },
  NVIDIATeslaK80: {
    label: "NVIDIA TESLA K80",
    apiValue: "NVIDIA_TESLA_K80",
    type: "gpu",
  },
  NVIDIATeslaA10G: {
    label: "NVIDIA TESLA A10G",
    apiValue: "NVIDIA_TESLA_A10G",
    type: "gpu",
  },
  AMDInstinctMI300XVF: {
    label: "AMD Instinct MI300X VF",
    apiValue: "AMD_Instinct_MI300X_VF",
    type: "gpu",
  },
  NVIDIAL40S: { label: "NVIDIA L40S", apiValue: "NVIDIA_L40S", type: "gpu" },
  NVIDIAL4: { label: "NVIDIA L4", apiValue: "NVIDIA_L4", type: "gpu" },
  NVIDIAL20: { label: "NVIDIA L20", apiValue: "NVIDIA_L20", type: "gpu" },
  NVIDIAA100: { label: "NVIDIA A100", apiValue: "NVIDIA_A100", type: "gpu" },
  NVIDIAH100: { label: "NVIDIA H100", apiValue: "NVIDIA_H100", type: "gpu" },
  NVIDIAH200: { label: "NVIDIA H200", apiValue: "NVIDIA_H200", type: "gpu" },
  HUAWEIAscend310P3: {
    label: "HUAWEI Ascend 310P3",
    apiValue: "HUAWEI_Ascend310P3",
    type: "npu",
  },
};

// Helper function to parse cluster resources from Ray API response
const parseClusterResources = (
  clusterStatus: RayClusterStatus | undefined,
): ClusterResources | null => {
  if (
    !clusterStatus?.result ||
    !clusterStatus.data?.clusterStatus?.loadMetricsReport?.usage
  ) {
    return null;
  }

  const usage = clusterStatus.data.clusterStatus.loadMetricsReport.usage;

  // Parse CPU (in cores)
  const cpuUsage = usage.CPU || [0, 0];
  const cpu = {
    available: Math.max(0, cpuUsage[1] - cpuUsage[0]),
    total: cpuUsage[1],
  };

  // Parse Memory (convert from bytes to GiB)
  const memoryUsage = usage.memory || [0, 0];
  const memory = {
    available: Math.max(0, (memoryUsage[1] - memoryUsage[0]) / 1024 ** 3),
    total: memoryUsage[1] / 1024 ** 3,
  };

  // Parse GPU
  const gpuUsage = usage.GPU || [0, 0];
  const gpu = {
    available: Math.max(0, gpuUsage[1] - gpuUsage[0]),
    total: gpuUsage[1],
  };

  // Parse NPU
  const npuUsage = usage.NPU || [0, 0];
  const npu = {
    available: Math.max(0, npuUsage[1] - npuUsage[0]),
    total: npuUsage[1],
  };

  // Parse accelerator types
  const acceleratorTypes = [];
  for (const [key, value] of Object.entries(usage)) {
    const resource = resourceMapping[key];
    if (resource) {
      acceleratorTypes.push({
        label: resource.label,
        value: resource.apiValue,
        available: Math.max(0, value[1] - value[0]),
        total: value[1],
        type: resource.type,
      });
    }
  }

  // Add generic options
  gpu.total && acceleratorTypes.unshift({
    label: "Generic",
    value: "-",
    available: gpu.available,
    total: gpu.total,
    type: "gpu",
  });
  npu.total && acceleratorTypes.unshift({
    label: "Generic",
    value: "-",
    available: npu.available,
    total: npu.total,
    type: "npu",
  });

  return {
    cpu,
    memory,
    gpu,
    npu,
    acceleratorTypes,
  };
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
          version: "latest",
          registry: "",
          file: "",
          task: "",
        },
        engine: {
          engine: "",
          version: "",
        },
        resources: {
          cpu: 1,
          memory: 1,
          gpu: 0,
          accelerator: {
            "-": 0,
            NPU: 0,
          },
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

  const workspace = form.watch("metadata.workspace");
  const currentModelName = form.watch("spec.model.name");
  const currentRegistry = form.watch("spec.model.registry");
  const currentCluster = form.watch("spec.cluster");
  const acceleratorValue = form.watch("spec.resources.accelerator");
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

  // Fetch cluster status for dynamic resource information
  const clusterStatusQuery = useCustom<RayClusterStatus>({
    url: `/ray-dashboard-proxy/${currentCluster}/api/cluster_status`,
    method: "get",
    queryOptions: {
      enabled: Boolean(currentCluster),
      refetchInterval: 30000, // Refresh every 30 seconds
    },
  });

  // Parse cluster resources from API response
  const clusterResources = useMemo(() => {
    return parseClusterResources(clusterStatusQuery.data?.data);
  }, [clusterStatusQuery.data?.data]);

  const isEdit = action === "edit";

  // Auto-initialize model search with current model name for better UX
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
      const mergedResources = deepMerge(
        currentFormData.spec.resources as Record<string, unknown>,
        selectedCatalog.spec.resources as Record<string, unknown>,
      );
      const mergedReplicas = deepMerge(
        currentFormData.spec.replicas as Record<string, unknown>,
        selectedCatalog.spec.replicas as Record<string, unknown>,
      );

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

  // Helper function to render accelerator fields (GPU/NPU)
  const renderAcceleratorFields = (type: "gpu" | "npu") => {
    const isGpu = type === "gpu";
    const totalResources = clusterResources?.[type];

    if (!totalResources?.total) {
      return null;
    }

    const typeOptions = (clusterResources?.acceleratorTypes || []).filter(
      (v) => v.type === type,
    );

    const currentAcceleratorType = Object.keys(acceleratorValue)[0];
    const currentAccelerator = clusterResources?.acceleratorTypes.find(
      (acc) => acc.value === currentAcceleratorType && acc.type === type,
    );

    // Extract computed values
    const currentAcceleratorValue = acceleratorValue[currentAcceleratorType] || 0;
    const specificAccelerator = clusterResources?.acceleratorTypes.find(
      (acc) => acc.value === currentAcceleratorType && acc.type === type,
    );
    const maxSliderValue = !clusterResources ? 2 : 
      (specificAccelerator?.available ?? totalResources?.available ?? 0);

    const typeLabel = isGpu
      ? t("endpoints.fields.gpu")
      : t("endpoints.fields.npu");
    const countLabel = isGpu
      ? t("endpoints.fields.gpuCount")
      : t("endpoints.fields.npuCount");
    const unitLabel = isGpu ? "GPUs" : "NPUs";
    const placeholderKey = isGpu
      ? "endpoints.placeholders.selectGpuType"
      : "endpoints.placeholders.selectNpuType";

    return (
      <>
        <Field {...form} name="-accelerator-type" label={typeLabel}>
          <Combobox
            placeholder={t(placeholderKey)}
            options={typeOptions}
            value={Object.keys(acceleratorValue)[0]}
            onChange={(value) => {
              const currentCount =
                acceleratorValue[Object.keys(acceleratorValue)[0]];
              form.setValue("spec.resources.accelerator", {
                [value as string]: currentCount,
              });
              
              // Update the corresponding accelerator field based on type
              if (type === "npu") {
                form.setValue(
                  "spec.resources.accelerator.NPU",
                  (currentCount as number) ?? 0,
                );
              } else {
                form.setValue(
                  `spec.resources.${type}`,
                  (currentCount as number) ?? 0,
                );
              }
            }}
            disabled={clusterStatusQuery.isLoading || !currentCluster}
          />
        </Field>

        <Field {...form} name="-accelerator-value" label={countLabel}>
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>
                {formatToDecimal(currentAcceleratorValue)} {unitLabel}
              </span>
              {clusterResources && (
                <span>
                  {currentAccelerator
                    ? `Available: ${currentAccelerator.available} / ${currentAccelerator.total}`
                    : `Available: ${totalResources?.available} / ${totalResources?.total}`}
                </span>
              )}
            </div>
            <Slider
              min={0}
              max={maxSliderValue}
              step={0.5}
              value={[currentAcceleratorValue]}
              onValueChange={(value) => {
                const currentAcceleratorType = Object.keys(acceleratorValue)[0];
                form.setValue("spec.resources.accelerator", {
                  [currentAcceleratorType]: value[0],
                });
                
                // Update the corresponding accelerator field based on type
                if (type === "npu") {
                  form.setValue(
                    "spec.resources.accelerator.NPU",
                    (value[0] as number) ?? 0,
                  );
                } else {
                  form.setValue(
                    `spec.resources.${type}`,
                    (value[0] as number) ?? 0,
                  );
                }
              }}
              disabled={clusterStatusQuery.isLoading || !currentCluster}
            />
          </div>
        </Field>
      </>
    );
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
        >
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{formatToDecimal(form.watch("spec.resources.cpu"))} cores</span>
              {clusterResources && (
                <span>
                  Available: {formatToDecimal(clusterResources.cpu.available)} /{" "}
                  {formatToDecimal(clusterResources.cpu.total)}
                </span>
              )}
            </div>
            <Slider
              min={0}
              max={clusterResources?.cpu.available ?? 0}
              step={0.1}
              value={[form.watch("spec.resources.cpu")]}
              onValueChange={(value) => {
                form.setValue("spec.resources.cpu", value[0]);
              }}
              disabled={clusterStatusQuery.isLoading || !currentCluster}
            />
          </div>
        </Field>

        <Field
          {...form}
          name="spec.resources.memory"
          label={t("endpoints.fields.memoryGb")}
        >
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{formatToDecimal(form.watch("spec.resources.memory"))} GiB</span>
              {clusterResources && (
                <span>
                  Available: {formatToDecimal(clusterResources.memory.available)} /{" "}
                  {formatToDecimal(clusterResources.memory.total)} GiB
                </span>
              )}
            </div>
            <Slider
              min={0}
              max={clusterResources?.memory.available ?? 0}
              step={0.5}
              value={[form.watch("spec.resources.memory")]}
              onValueChange={(value) => {
                form.setValue("spec.resources.memory", value[0]);
              }}
              disabled={clusterStatusQuery.isLoading || !currentCluster}
            />
          </div>
        </Field>

        {/* GPU Fields */}
        {renderAcceleratorFields("gpu")}

        {/* NPU Fields */}
        {renderAcceleratorFields("npu")}

        {/* Cluster status indicator */}
        {currentCluster && (
          <div className="col-span-4 mt-2">
            {clusterStatusQuery.isLoading ? (
              <div className="text-sm text-muted-foreground">
                {t("endpoints.messages.fetchingClusterResources")}...
              </div>
            ) : clusterStatusQuery.isError ? (
              <div className="text-sm text-red-600">
                {t("endpoints.messages.failedToFetchClusterResources")}
              </div>
            ) : !clusterResources ? (
              <div className="text-sm text-yellow-600">
                {t("endpoints.messages.clusterResourcesUnavailable")}
              </div>
            ) : null}
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
              {isEdit ? (
                <Input disabled />
              ) : (
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
              )}
            </Field>
            <Field
              {...form}
              name="spec.model.version"
              label={t("endpoints.fields.modelVersion")}
            >
              <Input disabled={isEdit} />
            </Field>
            <Field
              {...form}
              name="spec.model.file"
              label={t("endpoints.fields.modelFile")}
            >
              <Input disabled={isEdit} />
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
                  label: v,
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
                  { label: t("endpoints.options.powerOfTwo"), value: "pow2" },
                  {
                    label: t("endpoints.options.consistentHashing"),
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
          </FormCardGrid>
        </CollapsibleContent>
      </Collapsible>
    ),
  };
};
