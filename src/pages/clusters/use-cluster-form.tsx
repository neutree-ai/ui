import FormCardGrid from "@/components/business/FormCardGrid";
import NodeIPsField from "@/components/business/NodeIPsField";
import WorkspaceField from "@/components/business/WorkspaceField";
import { Combobox, Field, Select } from "@/components/theme";
import { useWorkspace } from "@/components/theme/hooks";
import { Input } from "@/components/ui/input";
import type { Cluster, ImageRegistry } from "@/types";
import { useSelect } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";

export const useClusterForm = ({ action }: { action: "create" | "edit" }) => {
  const { current: currentWorkspace } = useWorkspace();
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
        version: "v15",
      },
    },
  });

  const workspace = form.watch("metadata.workspace");
  const type = form.watch("spec.type");
  const isKubernetes = type === "kubernetes";

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
      <FormCardGrid title="Basic Information">
        <Field {...form} name="metadata.name" label="Name">
          <Input placeholder="Cluster Name" disabled={isEdit} />
        </Field>
        <Field {...form} name="metadata.workspace" label="Workspace">
          <WorkspaceField disabled={isEdit} />
        </Field>
      </FormCardGrid>
    ),
    imageRegistryFields: (
      <FormCardGrid>
        <Field {...form} name="spec.image_registry" label="Image Registry">
          <Combobox
            placeholder="Select A Image Registry"
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
      <FormCardGrid title="Cluster Type">
        <Field {...form} name="spec.type" label="Type">
          <Select
            options={[
              // { label: "Single Local Node", value: "local" },
              { label: "Multiple Static Nodes", value: "ssh" },
              { label: "Kubernetes", value: "kubernetes" },
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
                      cpu: 1,
                      memory: "2Gi",
                    },
                  },
                  worker_group_specs: [
                    {
                      group_name: "default",
                      min_replicas: 1,
                      max_replicas: 1,
                      resources: {
                        cpu: 1,
                        memory: "2Gi",
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
      <FormCardGrid title="Provider">
        {type === "ssh" && (
          <Field {...form} name="spec.config.provider" className="col-span-4">
            <NodeIPsField />
          </Field>
        )}

        {isKubernetes && (
          <>
            <Field
              {...form}
              name="spec.config.kubeconfig"
              label="Kubeconfig"
              className="col-span-4"
            >
              <Input type="password" disabled={isEdit} />
            </Field>
            <Field
              {...form}
              name="spec.config.head_node_spec.access_mode"
              label="Head Access Mode"
            >
              <Select
                options={[
                  { label: "LoadBalancer", value: "LoadBalancer" },
                  { label: "Ingress", value: "Ingress" },
                ]}
                disabled={isEdit}
              />
            </Field>

            <Field
              {...form}
              name="spec.config.head_node_spec.resources.cpu"
              label="Head Node CPU"
            >
              <Input type="number" disabled={isEdit} />
            </Field>

            <Field
              {...form}
              name="spec.config.head_node_spec.resources.memory"
              label="Head Node Memory"
            >
              <Input disabled={isEdit} />
            </Field>

            <div className="col-span-1" />

            <Field
              {...form}
              name="spec.config.worker_group_specs.0.min_replicas"
              label="Worker Node Replica"
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
              label="Worker Node CPU"
            >
              <Input type="number" disabled={isEdit} />
            </Field>

            <Field
              {...form}
              name="spec.config.worker_group_specs.0.resources.memory"
              label="Worker Node Memory"
            >
              <Input disabled={isEdit} />
            </Field>
          </>
        )}
      </FormCardGrid>
    ),
    authFields: isKubernetes ? null : (
      <FormCardGrid title="Node Authentication">
        <Field {...form} name="spec.config.auth.ssh_user" label="SSH User">
          <Input placeholder="e.g root" />
        </Field>
        <Field
          {...form}
          name="spec.config.auth.ssh_private_key"
          label="SSH Private Key"
        >
          <Input type="password" />
        </Field>
      </FormCardGrid>
    ),
  };
};
