import FormCardGrid from "@/components/business/FormCardGrid";
import NodeIPsField from "@/components/business/NodeIPsField";
import WorkspaceField from "@/components/business/WorkspaceField";
import { Combobox, Field, Select } from "@/components/theme";
import { useWorkspace } from "@/components/theme/hooks";
import { Input } from "@/components/ui/input";
import type { Cluster, ImageRegistry } from "@/types";
import { useSelect } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";
import { useTranslation } from "react-i18next";

export const useClusterForm = ({ action }: { action: "create" | "edit" }) => {
  const { t } = useTranslation();
  const { current: currentWorkspace } = useWorkspace();

  const NO_ACCELERATOR = "none"
  const acceleratorTypes = [
    { label: t("clusters.options.none"), value:NO_ACCELERATOR},
    { label: "NVIDIA GPU", value: "nvidia.com/gpu" },
    { label: "Ascend310P", value: "huawei.com/Ascend310P" },
  ];


  const form = useForm<Cluster>({
    mode: "all",
    defaultValues: {
      api_version: "v1",
      kind: "Cluster",
      metadata: {
        name: "",
        workspace: currentWorkspace,
      },
      spec: {
        image_registry: "",
        type: "ssh",
        config: {
          provider: {},
          auth: {
            ssh_user: "",
            ssh_private_key: "",
          },
        },
        version: import.meta.env.VITE_DEFAULT_CLUSTER_VERSION,
      },
    },
  });

  const workspace = form.watch("metadata.workspace");
  const type = form.watch("spec.type");
  const isKubernetes = type === "kubernetes";

  const headResources = form.watch("spec.config.head_node_spec.resources");
  const workerResources = form.watch(
    "spec.config.worker_group_specs.0.resources",
  );

  const getAcceleratorInfo = (
    resources: Record<string, string | number> | undefined,
  ) => {
    if (!resources) return { type: NO_ACCELERATOR, count: "0" };

    for (const acceleratorType of acceleratorTypes) {
      if (resources[acceleratorType.value]) {
        return {
          type: acceleratorType.value,
          count: resources[acceleratorType.value] as string,
        };
      }
    }
    return { type: NO_ACCELERATOR, count: "0" };
  };

  const headAccelerator = getAcceleratorInfo(headResources);
  const workerAccelerator = getAcceleratorInfo(workerResources);

  const updateAcceleratorResources = (
    resourcesPath: string,
    currentResources: Record<string, string | number> | undefined,
    newType: string,
    newCount: string,
  ) => {
    if (!currentResources) return;

    const newResources = { ...currentResources };
    for (const type of acceleratorTypes) {
      delete newResources[type.value];
    }
    if (newType !== NO_ACCELERATOR && newCount) {
      newResources[newType] = newCount;
    }

    if (resourcesPath === "spec.config.head_node_spec.resources") {
      form.setValue("spec.config.head_node_spec.resources", newResources);
    } else if (resourcesPath === "spec.config.worker_group_specs.0.resources") {
      form.setValue("spec.config.worker_group_specs.0.resources", newResources);
    }
  };

  const meta = {
    workspace,
  };

  const imageRegistries = useSelect<ImageRegistry>({
    resource: "image_registries",
    meta,
  });

  const isEdit = action === "edit";

  return {
    form,
    metadataFields: (
      <FormCardGrid title={t("clusters.sections.basicInformation")}>
        <Field {...form} name="metadata.name" label={t("clusters.fields.name")}>
          <Input
            placeholder={t("clusters.placeholders.clusterName")}
            disabled={isEdit}
          />
        </Field>
        <Field
          {...form}
          name="metadata.workspace"
          label={t("clusters.fields.workspace")}
        >
          <WorkspaceField disabled={isEdit} />
        </Field>
      </FormCardGrid>
    ),
    imageRegistryFields: (
      <FormCardGrid>
        <Field
          {...form}
          name="spec.image_registry"
          label={t("clusters.fields.imageRegistry")}
        >
          <Combobox
            placeholder={t("clusters.placeholders.selectImageRegistry")}
            options={(imageRegistries.query.data?.data || []).map((item) => ({
              label: item.metadata.name,
              value: item.metadata.name,
            }))}
            disabled={imageRegistries.query.isLoading || isEdit}
          />
        </Field>
      </FormCardGrid>
    ),
    typeFields: (
      <FormCardGrid title={t("clusters.sections.clusterType")}>
        <Field {...form} name="spec.type" label={t("clusters.fields.type")}>
          <Select
            options={[
              // { label: "Single Local Node", value: "local" },
              {
                label: t("clusters.options.multipleStaticNodes"),
                value: "ssh",
              },
              { label: t("clusters.options.kubernetes"), value: "kubernetes" },
            ]}
            onChange={(value) => {
              form.setValue("spec.type", value);
              if (value === "ssh") {
                form.setValue("spec.config", {
                  provider: {
                    head_ip: "",
                    worker_ips: [],
                  },
                  auth: {
                    ssh_user: "",
                    ssh_private_key: "",
                  },
                });
              } else if (value === "local") {
                form.setValue("spec.config", {
                  provider: {},
                  auth: {
                    ssh_user: "",
                    ssh_private_key: "",
                  },
                });
              } else if (value === "kubernetes") {
                form.setValue("spec.config", {
                  kubeconfig: "",
                  head_node_spec: {
                    access_mode: "LoadBalancer",
                    resources: {
                      cpu: "1",
                      memory: "2Gi",
                    },
                  },
                  worker_group_specs: [
                    {
                      group_name: "default",
                      min_replicas: 1,
                      max_replicas: 1,
                      resources: {
                        cpu: "1",
                        memory: "2Gi",
                        "nvidia.com/gpu": "0",
                      },
                    },
                  ],
                });
              }
            }}
            disabled={isEdit}
          />
        </Field>
      </FormCardGrid>
    ),
    providerFields: (
      <FormCardGrid title={t("clusters.sections.provider")}>
        {type === "ssh" && (
          <Field {...form} name="spec.config.provider" className="col-span-4">
            <NodeIPsField />
          </Field>
        )}

        {isKubernetes && (
          <Field
            {...form}
            name="spec.config.kubeconfig"
            label={t("clusters.fields.kubeconfig")}
            className="col-span-4"
          >
            <Input type="password" disabled={isEdit} />
          </Field>
        )}
      </FormCardGrid>
    ),
    headNodeFields: isKubernetes ? (
      <FormCardGrid title={t("clusters.sections.headNode")}>
        <Field
          {...form}
          name="spec.config.head_node_spec.access_mode"
          label={t("clusters.fields.accessMode")}
        >
          <Select
            options={[
              {
                label: t("clusters.options.loadBalancer"),
                value: "LoadBalancer",
              },
              { label: t("clusters.options.ingress"), value: "Ingress" },
            ]}
            disabled={isEdit}
          />
        </Field>

        <Field
          {...form}
          name="spec.config.head_node_spec.resources.cpu"
          label={t("clusters.fields.cpu")}
        >
          <Input disabled={isEdit} />
        </Field>

        <Field
          {...form}
          name="spec.config.head_node_spec.resources.memory"
          label={t("clusters.fields.memory")}
        >
          <Input disabled={isEdit} />
        </Field>

        <div />

        <Field
          {...form}
          name="spec.config.head_node_spec.accelerator_type"
          label={t("clusters.fields.acceleratorType")}
        >
          <Select
            options={acceleratorTypes}
            value={headAccelerator.type}
            onChange={(value) => {
              updateAcceleratorResources(
                "spec.config.head_node_spec.resources",
                headResources,
                value,
                headAccelerator.count,
              );
            }}
            disabled={isEdit}
          />
        </Field>

        <Field
          {...form}
          name="spec.config.head_node_spec.accelerator_count"
          label={t("clusters.fields.acceleratorCount")}
        >
          <Input
            disabled={isEdit || headAccelerator.type === NO_ACCELERATOR}
            value={headAccelerator.count}
            onChange={(evt) => {
              const value = evt.target.value;
              updateAcceleratorResources(
                "spec.config.head_node_spec.resources",
                headResources,
                headAccelerator.type,
                value,
              );
            }}
          />
        </Field>

        <div />
        <div />
      </FormCardGrid>
    ) : null,
    workerNodeFields: isKubernetes ? (
      <FormCardGrid title={t("clusters.sections.workerNode")}>
        <Field
          {...form}
          name="spec.config.worker_group_specs.0.min_replicas"
          label={t("clusters.fields.replicas")}
        >
          <Input
            type="number"
            disabled={isEdit}
            onChange={(evt) => {
              const value = Number(evt.target.value);
              form.setValue(
                "spec.config.worker_group_specs.0.min_replicas",
                value,
              );
              form.setValue(
                "spec.config.worker_group_specs.0.max_replicas",
                value,
              );
            }}
          />
        </Field>

        <Field
          {...form}
          name="spec.config.worker_group_specs.0.resources.cpu"
          label={t("clusters.fields.cpu")}
        >
          <Input disabled={isEdit} />
        </Field>

        <Field
          {...form}
          name="spec.config.worker_group_specs.0.resources.memory"
          label={t("clusters.fields.memory")}
        >
          <Input disabled={isEdit} />
        </Field>

        <div />

        <Field
          {...form}
          name="spec.config.worker_group_specs.0.accelerator_type"
          label={t("clusters.fields.acceleratorType")}
        >
          <Select
            options={acceleratorTypes}
            value={workerAccelerator.type}
            onChange={(value) => {
              updateAcceleratorResources(
                "spec.config.worker_group_specs.0.resources",
                workerResources,
                value,
                workerAccelerator.count,
              );
            }}
            disabled={isEdit}
          />
        </Field>

        <Field
          {...form}
          name="spec.config.worker_group_specs.0.accelerator_count"
          label={t("clusters.fields.acceleratorCount")}
        >
          <Input
            disabled={isEdit || workerAccelerator.type === NO_ACCELERATOR}
            value={workerAccelerator.count}
            onChange={(evt) => {
              const value = evt.target.value;
              updateAcceleratorResources(
                "spec.config.worker_group_specs.0.resources",
                workerResources,
                workerAccelerator.type,
                value,
              );
            }}
          />
        </Field>

        <div />
        <div />
      </FormCardGrid>
    ) : null,
    authFields: isKubernetes ? null : (
      <FormCardGrid title={t("clusters.sections.nodeAuthentication")}>
        <Field
          {...form}
          name="spec.config.auth.ssh_user"
          label={t("clusters.fields.sshUser")}
        >
          <Input placeholder={t("clusters.placeholders.sshUserExample")} />
        </Field>
        <Field
          {...form}
          name="spec.config.auth.ssh_private_key"
          label={t("clusters.fields.sshPrivateKey")}
        >
          <Input type="password" />
        </Field>
      </FormCardGrid>
    ),
  };
};
