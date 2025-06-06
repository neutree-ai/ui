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
import { useMemo, useState, useEffect, useRef } from "react";
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

export const useEndpointForm = ({ action }: { action: "create" | "edit" }) => {
  const { t } = useTranslation();
  const { current: currentWorkspace } = useWorkspace();
  const [selectedModelCatalog, setSelectedModelCatalog] = useState<string>("");
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [modelSearch, setModelSearch] = useState("");

  const previousValuesRef = useRef<{
    currentModelName?: string;
    currentRegistry?: string;
  }>({});

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
        enabled: true,
      },
    },
    warnWhenUnsavedChanges: true,
  });

  const workspace = form.watch("metadata.workspace");
  const currentModelName = form.watch("spec.model.name");
  const currentRegistry = form.watch("spec.model.registry");
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

  const isEdit = action === "edit";

  // Auto-initialize model search with template model name when available
  const effectiveModelSearch = useMemo(() => {
    if (modelSearch) return modelSearch;
    if (currentRegistry && currentModelName && !isEdit) {
      return currentModelName;
    }
    return "";
  }, [modelSearch, currentRegistry, currentModelName, isEdit]);

  const shouldFetchModels = Boolean(currentRegistry && effectiveModelSearch);
  const modelsData = useCustom({
    url: `/workspaces/${workspace}/model_registries/${currentRegistry}/models?search=${effectiveModelSearch}`,
    method: "get",
    queryOptions: {
      enabled: shouldFetchModels,
    },
  });

  const isModelFoundInRegistry = useMemo(() => {
    if (!modelsData.data?.data || !currentModelName || !currentRegistry) {
      return false;
    }
    return modelsData.data.data.some(
      (model: GeneralModel) => model.name === currentModelName,
    );
  }, [modelsData.data?.data, currentModelName, currentRegistry]);

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

  useEffect(() => {
    const prev = previousValuesRef.current;

    if (
      prev.currentModelName === currentModelName &&
      prev.currentRegistry === currentRegistry
    ) {
      return;
    }

    previousValuesRef.current = {
      currentModelName,
      currentRegistry,
    };

    if (action === "create" && currentRegistry && currentModelName) {
      if (!isModelFoundInRegistry && modelsData.data) {
        form.setError("spec.model.name", {
          type: "manual",
          message: `${t("endpoints.messages.modelNotFoundInRegistry")}`,
        });
      } else if (isModelFoundInRegistry) {
        form.clearErrors("spec.model.name");
      }
    }
  }, [
    isModelFoundInRegistry,
    currentRegistry,
    currentModelName,
    modelsData.data,
    action,
    form,
    t,
  ]);

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
              // Reset model search when registry changes
              setModelSearch("");
            }}
          />
        </Field>
        {!isEdit && (
          <Field {...form} name="-" label={t("endpoints.fields.modelCatalog")}>
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
            {form.watch("spec.resources.cpu")}
            <Slider min={0} max={20} step={0.1} />
          </div>
        </Field>

        <Field
          {...form}
          name="spec.resources.memory"
          label={t("endpoints.fields.memoryGb")}
        >
          <div className="flex flex-col gap-2">
            {form.watch("spec.resources.memory")}
            <Slider min={0} max={50} step={0.5} />
          </div>
        </Field>

        <Field {...form} name="-" label={t("endpoints.fields.gpu")}>
          <Combobox
            placeholder={t("endpoints.placeholders.selectGpuType")}
            options={[
              { label: t("endpoints.options.generic"), value: "-" },
              { label: t("endpoints.options.l4"), value: "NVIDIA_L4" },
              { label: t("endpoints.options.t4"), value: "NVIDIA_TESLA_T4" },
            ]}
            value={Object.keys(acceleratorValue)[0]}
            onChange={(value) => {
              form.setValue("spec.resources.accelerator", {
                [value as string]:
                  acceleratorValue[Object.keys(acceleratorValue)[0]],
              });
            }}
          />
        </Field>

        <Field {...form} name="-" label={t("endpoints.fields.gpuCount")}>
          <div className="flex flex-col gap-2">
            {Object.values(acceleratorValue)[0] as number}
            <Slider
              min={0}
              max={2}
              step={0.5}
              value={Object.values(acceleratorValue) as number[]}
              onValueChange={(value) => {
                form.setValue("spec.resources.accelerator", {
                  [Object.keys(acceleratorValue)[0]]: value[0],
                });
                form.setValue("spec.resources.gpu", (value[0] as number) ?? 0);
              }}
            />
          </div>
        </Field>
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
                    // Disable if no registry selected OR model not found in registry after search
                    disabled={
                      !currentRegistry ||
                      (!isModelFoundInRegistry && !!modelsData.data)
                    }
                    // Show template model name even when disabled
                    value={currentModelName}
                    // Handle model selection
                    onChange={(value: string) => {
                      form.setValue("spec.model.name", value);
                    }}
                  />
                  {/* Show validation status */}
                  {currentRegistry && currentModelName && modelsData.data && (
                    <div className="text-sm">
                      {isModelFoundInRegistry ? null : (
                        <span className="text-red-600">
                          {t("endpoints.messages.modelNotFoundInRegistry")}
                        </span>
                      )}
                    </div>
                  )}
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
