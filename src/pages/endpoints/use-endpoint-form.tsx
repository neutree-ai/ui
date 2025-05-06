import { useForm } from "@refinedev/react-hook-form";
import { Combobox, Field } from "@/components/theme";
import type {
  Cluster,
  Endpoint,
  Engine,
  EngineVersion,
  GeneralModel,
  ModelRegistry,
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

export const useEndpointForm = ({ action }: { action: "create" | "edit" }) => {
  const { current: currentWorkspace } = useWorkspace();

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

  const [modelSearch, setModelSearch] = useState("");
  const modelsData = useCustom({
    url: `/search-models/${
      form.getValues().spec.model.registry
    }?search=${modelSearch}`,
    method: "get",
    queryOptions: {
      enabled: Boolean(form.getValues().spec.model.registry),
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
  }, [engines]);

  const isEdit = action === "edit";

  const acceleratorValue = form.watch("spec.resources.accelerator");
  const engineSpec = form.watch("spec.engine");
  const engineValueSchema = engineSpec.engine
    ? engineVersions[engineSpec.engine]?.find(
        (v) => v.version === engineSpec.version,
      )?.values_schema
    : undefined;

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
    modelFields: (
      <FormCardGrid>
        <Field {...form} name="spec.model.registry" label="Model Registry">
          <Combobox
            placeholder="Select A Model Registry"
            disabled={modelRegistries.query.isLoading || isEdit}
            options={(modelRegistries.query.data?.data || []).map((e) => ({
              label: e.metadata.name,
              value: e.metadata.name,
            }))}
          />
        </Field>
        <Field {...form} name="spec.model.name" label="Model Name">
          {isEdit ? (
            <Input disabled />
          ) : (
            <AsyncCombobox
              placeholder="Select A Model"
              loading={
                modelsData.isFetching ? (
                  <CommandLoading className="px-2 py-1.5 text-muted-foreground">
                    fetching...
                  </CommandLoading>
                ) : null
              }
              options={(modelsData.data?.data || []).map((e: GeneralModel) => {
                return {
                  label: e.name,
                  value: e.name,
                };
              })}
              shouldFilter={false}
              onSearchChange={setModelSearch}
              triggerClassName="w-full"
            />
          )}
        </Field>
        <Field {...form} name="spec.model.version" label="Model Version">
          <Input disabled={isEdit} />
        </Field>
        <Field {...form} name="spec.model.file" label="Model File">
          <Input disabled={isEdit} />
        </Field>
      </FormCardGrid>
    ),
    resourceFields: (
      <FormCardGrid>
        <Field {...form} name="spec.cluster" label="Clusters">
          <Combobox
            disabled={clusters.query.isLoading || isEdit}
            placeholder="Select A Cluster"
            options={(clusters.query?.data?.data || []).map((e) => {
              return {
                label: e.metadata.name,
                value: e.metadata.name,
              };
            })}
          />
        </Field>
        <div className="col-span-3" />

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
                form.setValue("spec.resources.gpu", (value[0] as number) ?? 0);
              }}
            />
          </div>
        </Field>
      </FormCardGrid>
    ),
    engineFields: (
      <FormCardGrid>
        <Field {...form} name="spec.engine.engine" label="Engine">
          <Combobox
            placeholder="Select An Engine"
            disabled={engines.query.isLoading || isEdit}
            options={engineNames.map((v) => ({
              label: v,
              value: v,
            }))}
            onChange={(value) => {
              form.setValue("spec.engine", {
                engine: value,
                version: engineVersions[String(value)][0].version,
              });
              form.setValue("spec.model.task", engineTasks[String(value)][0]);
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
    ),
    replicaFields: (
      <FormCardGrid>
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
    ),
    advancedFields: (
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
    ),
  };
};
