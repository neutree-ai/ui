import { useCustom, useSelect } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import type { FieldPath, FieldPathValue } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Combobox as AsyncCombobox } from "@/components/ui/combobox";
import { CommandLoading } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatTaskName } from "@/domains/endpoint/components/ModelTask";
import { SliderWithInput } from "@/domains/endpoint/components/SliderWithInput";
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

type EndpointDeploymentMode = "standard" | "pd";
type EndpointRoleName = "prefill" | "decode";
type EndpointFormPath = FieldPath<Endpoint>;
type EndpointFormValue = FieldPathValue<Endpoint, EndpointFormPath>;
type ResourceAccelerator = NonNullable<
  Endpoint["spec"]["resources"]
>["accelerator"];

const roleIndexByName: Record<EndpointRoleName, number> = {
  prefill: 0,
  decode: 1,
};

const endpointPath = (path: string) => path as EndpointFormPath;
const endpointValue = (value: unknown) => value as EndpointFormValue;

export const useEndpointForm = ({ action }: { action: "create" | "edit" }) => {
  const { t } = useTranslation();
  const { current: currentWorkspace } = useWorkspace();
  const [selectedModelCatalog, setSelectedModelCatalog] = useState<string>("");
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const [activeRole, setActiveRole] = useState<EndpointRoleName>("prefill");

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
  const deploymentMode: EndpointDeploymentMode =
    form.watch("spec.strategy") === "pd" ? "pd" : "standard";
  const isPdMode = deploymentMode === "pd";
  const activeRoleIndex = roleIndexByName[activeRole];

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

  const selectedAccelerator = (
    isPdMode
      ? form.watch(
          endpointPath(`spec.roles.${activeRoleIndex}.resources.accelerator`),
        )
      : form.watch("spec.resources.accelerator")
  ) as ResourceAccelerator;
  const cpuUsage = Number(
    (isPdMode
      ? form.watch(endpointPath(`spec.roles.${activeRoleIndex}.resources.cpu`))
      : form.watch("spec.resources.cpu")) || 0,
  );
  const memoryUsage = Number(
    (isPdMode
      ? form.watch(
          endpointPath(`spec.roles.${activeRoleIndex}.resources.memory`),
        )
      : form.watch("spec.resources.memory")) || 0,
  );

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

  // Set the branch value and each nested value so exact FormField watchers
  // update for objects, arrays, and scalar spec fields.
  const setFormValueTree = (basePath: string, value: unknown) => {
    form.setValue(endpointPath(basePath), endpointValue(value));

    if (typeof value !== "object" || value === null) {
      return;
    }

    for (const [key, nestedValue] of Object.entries(value)) {
      setFormValueTree(`${basePath}.${key}`, nestedValue);
    }
  };

  // Apply a merged catalog spec (or defaults when null) to the form.
  const applyCatalogSpec = (catalogSpec: Record<string, unknown> | null) => {
    const merged = buildCatalogMergedSpec(catalogSpec);
    for (const [key, value] of Object.entries(merged)) {
      setFormValueTree(`spec.${key}`, value);
    }
  };

  // Handle model catalog selection with merge logic
  const handleModelCatalogSelect = (catalogId: string) => {
    setSelectedModelCatalog(catalogId);

    if (!catalogId) {
      applyCatalogSpec(null);
      return;
    }

    const selectedCatalog = modelCatalogs.query.data?.data.find(
      (catalog) => catalog.id.toString() === catalogId,
    );

    if (selectedCatalog) {
      applyCatalogSpec(selectedCatalog.spec as Record<string, unknown>);
    }
  };

  const cloneDefaultRoles = () =>
    defaultEndpointSpec.roles.map((role) => ({
      name: role.name,
      replicas: { ...role.replicas },
      resources: { ...role.resources },
      variables: { engine_args: {} },
      env: {},
    }));

  const handleDeploymentModeChange = (mode: EndpointDeploymentMode) => {
    if (mode === deploymentMode) return;

    if (mode === "pd") {
      form.setValue("spec.strategy", "pd");
      form.setValue("spec.placement", { roles: "same-host" });
      form.setValue("spec.replicas.num", 1);

      if (!form.getValues("spec.roles")?.length) {
        form.setValue("spec.roles", cloneDefaultRoles());
      }
      if (!form.getValues("spec.kv")) {
        form.setValue("spec.kv", defaultEndpointSpec.kv);
      }
      setActiveRole("prefill");
      return;
    }

    form.setValue("spec.strategy", "");
    form.setValue("spec.placement", defaultEndpointSpec.placement);
    if (!form.getValues("spec.resources")) {
      form.setValue("spec.resources", { ...defaultEndpointSpec.resources });
    }
    if (!form.getValues("spec.replicas")) {
      form.setValue("spec.replicas", { ...defaultEndpointSpec.replicas });
    }
    if (!form.getValues("spec.deployment_options")) {
      form.setValue("spec.deployment_options", {
        scheduler: { ...defaultEndpointSpec.deployment_options.scheduler },
      });
    }
  };

  const currentEngine = form.watch("spec.engine.engine");
  const currentEngineVersions = engineVersions[currentEngine] || [];
  const currentEngineTasks = engineTasks[currentEngine] || [];

  const modelNameField = (
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
          options={(modelsData.data?.data || []).map((e: { name: string }) => {
            return {
              label: e.name,
              value: e.name,
            };
          })}
          shouldFilter={false}
          onSearchChange={setModelSearch}
          triggerClassName="w-full"
          disabled={!currentRegistry}
          value={currentModelName}
          onChange={(value: string) => {
            form.setValue("spec.model.name", value);
          }}
        />
      </div>
    </FormFieldGroup>
  );

  const engineRuntimeFields = (
    <>
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
            const engine = String(value);
            const versions = engineVersions[engine] || [];
            const tasks = engineTasks[engine] || [];

            form.setValue("spec.engine", {
              engine,
              version: versions[0]?.version ?? "",
            });
            form.setValue("spec.model.task", tasks[0] ?? "");
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
          disabled={!currentEngine}
          options={currentEngineVersions.map(({ version: v }) => ({
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
          disabled={!currentEngine}
          options={currentEngineTasks.map((v) => ({
            label:
              t(`models.tasks.${v}`) === `models.tasks.${v}`
                ? formatTaskName(v)
                : t(`models.tasks.${v}`),
            value: v,
          }))}
        />
      </FormFieldGroup>
    </>
  );

  const renderDeploymentModeButton = (
    mode: EndpointDeploymentMode,
    label: string,
  ) => (
    <Button
      type="button"
      variant={deploymentMode === mode ? "default" : "outline"}
      aria-pressed={deploymentMode === mode}
      disabled={isEdit}
      onClick={() => handleDeploymentModeChange(mode)}
      className="justify-center"
    >
      {label}
    </Button>
  );

  const renderResourceFields = (basePath: string, roleIndex?: number) => {
    const acceleratorPath = `${basePath}.accelerator`;
    const currentGpu = Number(form.watch(endpointPath(`${basePath}.gpu`)) || 0);
    const currentAccelerator = form.watch(
      endpointPath(acceleratorPath),
    ) as ResourceAccelerator;

    return (
      <>
        <FormFieldGroup
          {...form}
          name={endpointPath(`${basePath}.cpu`)}
          label={t("common.fields.cpu")}
          className="col-span-2"
        >
          <SliderWithInput
            value={Number(form.watch(endpointPath(`${basePath}.cpu`)) || 0)}
            onChange={(value) =>
              form.setValue(endpointPath(`${basePath}.cpu`), value)
            }
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
          name={endpointPath(`${basePath}.memory`)}
          label={t("endpoints.fields.memoryGb")}
          className="col-span-2"
        >
          <SliderWithInput
            value={Number(form.watch(endpointPath(`${basePath}.memory`)) || 0)}
            onChange={(value) =>
              form.setValue(endpointPath(`${basePath}.memory`), value)
            }
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

        <FormFieldGroup
          {...form}
          name={endpointPath(acceleratorPath)}
          label={t("endpoints.fields.accelerator")}
          className="col-span-4"
        >
          <FormCombobox
            options={acceleratorOptions.map((opt) => ({
              label: opt.label,
              value: opt.value,
            }))}
            value={
              currentAccelerator?.type && currentAccelerator?.product
                ? `${currentAccelerator.type}:${currentAccelerator.product}`
                : ""
            }
            onChange={(value) => {
              const selectedOption = acceleratorOptions.find(
                (opt) => opt.value === value,
              );
              if (selectedOption) {
                form.setValue(endpointPath(acceleratorPath), {
                  type: selectedOption.type,
                  product: selectedOption.product,
                });
              } else {
                form.setValue(endpointPath(acceleratorPath), null);
              }
            }}
            placeholder={t("endpoints.placeholders.selectAccelerator")}
            disabled={!currentCluster || acceleratorOptions.length === 0}
            emptyMessage={t("endpoints.messages.noAcceleratorsAvailable")}
          />
        </FormFieldGroup>

        {currentAccelerator?.type && currentAccelerator?.product && (
          <FormFieldGroup
            {...form}
            name={endpointPath(`${basePath}.gpu`)}
            label={t("endpoints.fields.acceleratorCount")}
            className="col-span-4"
          >
            <SliderWithInput
              value={currentGpu}
              onChange={(value) =>
                form.setValue(endpointPath(`${basePath}.gpu`), value)
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
          </FormFieldGroup>
        )}

        {roleIndex != null && (
          <>
            <FormFieldGroup
              {...form}
              name={endpointPath(
                `spec.roles.${roleIndex}.variables.engine_args`,
              )}
              label={t("endpoints.fields.engineVariables")}
              className="col-span-4"
            >
              <VariablesInput
                schema={engineValueSchema?.properties as unknown as Schema}
              />
            </FormFieldGroup>
            <FormFieldGroup
              {...form}
              name={endpointPath(`spec.roles.${roleIndex}.env`)}
              label={t("endpoints.fields.environment")}
              className="col-span-4"
            >
              <VariablesInput schema={{}} />
            </FormFieldGroup>
          </>
        )}
      </>
    );
  };

  const renderRoleTab = (role: EndpointRoleName) => {
    const roleIndex = roleIndexByName[role];
    const basePath = `spec.roles.${roleIndex}.resources`;

    return (
      <TabsContent value={role} className="mt-4" forceMount>
        <div className="grid grid-cols-4 xs:grid-cols-1 gap-4">
          <FormFieldGroup
            {...form}
            name={endpointPath(`spec.roles.${roleIndex}.replicas.num`)}
            label={t(`endpoints.fields.${role}Instances`)}
            className="col-span-4"
          >
            <Input type="number" min={1} />
          </FormFieldGroup>
          {renderResourceFields(basePath, roleIndex)}
        </div>
      </TabsContent>
    );
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
        {modelNameField}
        {engineRuntimeFields}
      </FormCardGrid>
    ),
    deploymentModeFields: (
      <FormCardGrid title={t("endpoints.sections.deploymentMode")}>
        <div className="col-span-4 grid grid-cols-2 xs:grid-cols-1 gap-2">
          {renderDeploymentModeButton(
            "standard",
            t("endpoints.deploymentModes.standard"),
          )}
          {renderDeploymentModeButton(
            "pd",
            t("endpoints.deploymentModes.prefillDecode"),
          )}
        </div>
      </FormCardGrid>
    ),
    // Resource settings section - always visible
    resourceFields: isPdMode ? null : (
      <FormCardGrid title={t("endpoints.sections.resourceSettings")}>
        <FormFieldGroup
          {...form}
          name="spec.resources.cpu"
          label={t("common.fields.cpu")}
          className="col-span-2"
        >
          <SliderWithInput
            value={Number(form.watch("spec.resources.cpu") || 0)}
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
            value={Number(form.watch("spec.resources.memory") || 0)}
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
                const currentGpu = Number(
                  form.watch("spec.resources.gpu") || 0,
                );

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
    roleFields: !isPdMode ? null : (
      <FormCardGrid title={t("endpoints.sections.roleSettings")}>
        <div className="col-span-4">
          <Tabs
            value={activeRole}
            onValueChange={(value) => setActiveRole(value as EndpointRoleName)}
          >
            <TabsList>
              <TabsTrigger value="prefill">
                {t("endpoints.roles.prefill")}
              </TabsTrigger>
              <TabsTrigger value="decode">
                {t("endpoints.roles.decode")}
              </TabsTrigger>
            </TabsList>
            {renderRoleTab("prefill")}
            {renderRoleTab("decode")}
          </Tabs>
        </div>
      </FormCardGrid>
    ),
    kvFields: !isPdMode ? null : (
      <FormCardGrid title={t("endpoints.sections.kvSettings")}>
        <FormFieldGroup
          {...form}
          name="spec.kv.transfer.connector"
          label={t("endpoints.fields.kvConnector")}
          className="col-span-2"
        >
          <FormCombobox
            placeholder={t("endpoints.placeholders.defaultKvConnector")}
            options={[
              {
                label: t("endpoints.placeholders.defaultKvConnector"),
                value: "",
              },
              { label: "nixl", value: "nixl" },
            ]}
          />
        </FormFieldGroup>
        <FormFieldGroup
          {...form}
          name="spec.kv.transfer.extra"
          label={t("endpoints.fields.kvExtraOptions")}
          className="col-span-4"
        >
          <VariablesInput schema={{}} />
        </FormFieldGroup>
      </FormCardGrid>
    ),
    // Collapsible customize section for both create and edit modes
    customizeFields: isPdMode ? null : (
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
