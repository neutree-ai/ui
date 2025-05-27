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
import { useMemo, useState, useEffect } from "react";
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
      // Smart override logic: only replace if target is "empty" or default
      const shouldOverride =
        targetValue === "" ||
        targetValue === null ||
        targetValue === undefined ||
        (typeof targetValue === "number" && targetValue === 0) ||
        (typeof targetValue === "string" && targetValue.trim() === "") ||
        (Array.isArray(targetValue) && targetValue.length === 0) ||
        (typeof targetValue === "object" &&
          targetValue !== null &&
          Object.keys(targetValue as Record<string, unknown>).length === 0) ||
        // Special case for default values
        (key === "version" && targetValue === "latest") ||
        (key === "type" && targetValue === "consistent_hash"); // Default scheduler type

      if (shouldOverride) {
        result[key] = sourceValue;
      }
      // If target has a meaningful value, keep it (user's preference)
    }
  }

  return result;
};

export const useEndpointForm = ({ action }: { action: "create" | "edit" }) => {
  const { current: currentWorkspace } = useWorkspace();
  const [selectedModelCatalog, setSelectedModelCatalog] = useState<string>("");
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);

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

  const meta = {
    workspace,
  };

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

  const [modelSearch, setModelSearch] = useState("");

  const currentModelName = form.watch("spec.model.name");
  const currentRegistry = form.watch("spec.model.registry");

  const isEdit = action === "edit";

  // Auto-initialize model search with template model name when available
  const effectiveModelSearch = useMemo(() => {
    if (modelSearch) return modelSearch;
    if (currentRegistry && currentModelName && !isEdit) {
      return currentModelName;
    }
    return "";
  }, [modelSearch, currentRegistry, currentModelName, isEdit]);

  const modelsData = useCustom({
    url: `/workspaces/${workspace}/model_registries/${currentRegistry}/models?search=${effectiveModelSearch}`,
    method: "get",
    queryOptions: {
      enabled: Boolean(currentRegistry && effectiveModelSearch),
    },
  });

  // Computed: Check if current model name exists in search results
  const isModelFoundInRegistry = useMemo(() => {
    if (!modelsData.data?.data || !currentModelName || !currentRegistry) {
      return false;
    }
    return modelsData.data.data.some(
      (model: GeneralModel) => model.name === currentModelName,
    );
  }, [modelsData.data, currentModelName, currentRegistry]);

  // Custom validation effect for model availability
  useEffect(() => {
    if (action === "create" && currentRegistry && currentModelName) {
      if (!isModelFoundInRegistry && modelsData.data) {
        form.setError("spec.model.name", {
          type: "manual",
          message: `Model "${currentModelName}" not found in registry "${currentRegistry}". Please select a valid model or choose a different registry.`,
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
  ]);

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
  }, [engines]);

  const acceleratorValue = form.watch("spec.resources.accelerator");
  const engineSpec = form.watch("spec.engine");
  const engineValueSchema = engineSpec.engine
    ? engineVersions[engineSpec.engine]?.find(
        (v) => v.version === engineSpec.version,
      )?.values_schema
    : undefined;

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

  console.log({
    isModelFoundInRegistry,
    currentRegistry,
    currentModelName,
    mdata: modelsData.data,
  });

  return {
    form,
    metadataFields: (
      <FormCardGrid title="Basic Information">
        <Field {...form} name="metadata.name" label="Name">
          <Input placeholder="Endpoint Name" disabled={isEdit} />
        </Field>
        <Field {...form} name="metadata.workspace" label="Workspace">
          <WorkspaceField disabled={isEdit} />
        </Field>
      </FormCardGrid>
    ),
    // Template selection section for both create and edit modes
    templateFields: (
      <FormCardGrid title={isEdit ? "Configuration" : "Template Selection"}>
        <Field {...form} name="spec.cluster" label="Cluster">
          <Combobox
            disabled={clusters.query.isLoading}
            placeholder="Select A Cluster"
            options={(clusters.query?.data?.data || []).map((e) => {
              return {
                label: e.metadata.name,
                value: e.metadata.name,
              };
            })}
          />
        </Field>
        <Field {...form} name="spec.model.registry" label="Model Registry">
          <Combobox
            placeholder="Select A Model Registry"
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
          <Field {...form} name="-" label="Model Catalog (Template)">
            <Combobox
              placeholder="Select A Model Catalog"
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
    // Collapsible customize section for both create and edit modes
    customizeFields: (
      <Collapsible open={isCustomizeOpen} onOpenChange={setIsCustomizeOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            {isEdit ? "Configuration Details" : "Customize Settings"}
            {isCustomizeOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 mt-4">
          <FormCardGrid title="Model Settings">
            <Field {...form} name="spec.model.name" label="Model Name">
              {isEdit ? (
                <Input disabled />
              ) : (
                <div className="space-y-2">
                  <AsyncCombobox
                    placeholder="Select A Model"
                    loading={
                      modelsData.isFetching ? (
                        <CommandLoading className="px-2 py-1.5 text-muted-foreground">
                          fetching...
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
                          Model not found in selected registry
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </Field>
            <Field {...form} name="spec.model.version" label="Model Version">
              <Input disabled={isEdit} />
            </Field>
            <Field {...form} name="spec.model.file" label="Model File">
              <Input disabled={isEdit} />
            </Field>
          </FormCardGrid>

          <FormCardGrid title="Resource Settings">
            <Field {...form} name="spec.resources.cpu" label="CPU">
              <div className="flex flex-col gap-2">
                {form.watch("spec.resources.cpu")}
                <Slider min={0} max={20} step={0.1} />
              </div>
            </Field>

            <Field {...form} name="spec.resources.memory" label="Memory (GB)">
              <div className="flex flex-col gap-2">
                {form.watch("spec.resources.memory")}
                <Slider min={0} max={50} step={0.5} />
              </div>
            </Field>

            <Field {...form} name="-" label="GPU">
              <Combobox
                placeholder="Select GPU Type"
                options={[
                  { label: "Generic", value: "-" },
                  { label: "L4", value: "NVIDIA_L4" },
                  { label: "T4", value: "NVIDIA_TESLA_T4" },
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

            <Field {...form} name="-" label="GPU Count">
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
                    form.setValue(
                      "spec.resources.gpu",
                      (value[0] as number) ?? 0,
                    );
                  }}
                />
              </div>
            </Field>
          </FormCardGrid>

          <FormCardGrid title="Engine Settings">
            <Field {...form} name="spec.engine.engine" label="Engine">
              <Combobox
                placeholder="Select An Engine"
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
            <Field {...form} name="spec.engine.version" label="Engine Version">
              <Combobox
                placeholder="Select A Version"
                disabled={!form.getValues().spec.engine.engine}
                options={(
                  engineVersions[form.getValues().spec.engine.engine] || []
                ).map(({ version: v }) => ({
                  label: v,
                  value: v,
                }))}
              />
            </Field>
            <Field {...form} name="spec.model.task" label="Task Type">
              <Combobox
                placeholder="Select A Support Task Type"
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

          <FormCardGrid title="Replica Settings">
            <Field {...form} name="spec.replicas.num" label="Replicas">
              <Input type="number" />
            </Field>

            <Field
              {...form}
              name="spec.deployment_options.scheduler.type"
              label="Scheduler Type"
            >
              <Combobox
                placeholder="Select Scheduler Type"
                options={[
                  { label: "Power of two", value: "pow2" },
                  {
                    label: "Consistent hashing",
                    value: "consistent_hash",
                  },
                ]}
              />
            </Field>
          </FormCardGrid>

          <FormCardGrid title="Advanced Options">
            <Field
              {...form}
              name="spec.variables.engine_args"
              label="Engine Variables"
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
