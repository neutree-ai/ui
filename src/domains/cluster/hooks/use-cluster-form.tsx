import { useCustom, useSelect } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ModelCacheFields } from "@/domains/cluster/components/ModelCacheFields";
import NodeIPsField from "@/domains/cluster/components/NodeIPsField";
import { transformClusterValues } from "@/domains/cluster/lib/transform-cluster-values";
import type { Cluster } from "@/domains/cluster/types";
import FormCardGrid from "@/foundation/components/FormCardGrid";
import { FormCombobox } from "@/foundation/components/FormCombobox";
import { FormFieldGroup } from "@/foundation/components/FormFieldGroup";
import { FormSelect } from "@/foundation/components/FormSelect";
import WorkspaceField from "@/foundation/components/WorkspaceField";
import { useWorkspace } from "@/foundation/hooks/use-workspace";

export const useClusterForm = ({ action }: { action: "create" | "edit" }) => {
  const { t } = useTranslation();
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
          ssh_config: {
            provider: {},
            auth: {
              ssh_user: "",
              ssh_private_key: "",
            },
          },
          model_caches: [],
        },
        version: import.meta.env.VITE_DEFAULT_CLUSTER_VERSION,
      },
    },
  });

  const isEdit = action === "edit";

  const originalOnFinish = form.refineCore.onFinish;
  form.refineCore.onFinish = async (values) => {
    const transformedValues = transformClusterValues(values as Cluster, isEdit);

    return originalOnFinish(transformedValues);
  };

  const workspace = form.watch("metadata.workspace");
  const type = form.watch("spec.type");
  const isKubernetes = type === "kubernetes";
  const isSSH = type === "ssh";
  const isModelCacheDisabled = isEdit && isSSH;

  const meta = { workspace };

  const imageRegistries = useSelect({
    resource: "image_registries",
    meta,
  });

  const imageRegistry = form.watch("spec.image_registry");

  const versionsQueryEnabled = !!workspace && !!imageRegistry && !!type;

  const { data: versionsData, isLoading: isLoadingVersions } = useCustom<{
    available_versions: string[];
  }>({
    url: versionsQueryEnabled
      ? `/clusters/available_versions?${new URLSearchParams({ workspace, image_registry: imageRegistry, cluster_type: type }).toString()}`
      : "",
    method: "get",
    queryOptions: {
      enabled: versionsQueryEnabled,
    },
  });

  const availableVersions = versionsData?.data?.available_versions ?? [];

  const specVersion = form.watch("spec.version");

  // In edit mode, ensure the current version appears in the options list
  // even if the API doesn't return it (it only returns upgrade targets).
  const versionOptions = (() => {
    if (isEdit && specVersion && !availableVersions.includes(specVersion)) {
      return [specVersion, ...availableVersions];
    }
    return availableVersions;
  })();

  // Sync spec.version with available versions in create mode:
  // - No versions available: clear spec.version
  // - Version not set or not in list: select latest
  // Skip in edit mode — the form already has the cluster's existing spec.version.
  useEffect(() => {
    if (isEdit) return;
    const currentVersion = form.getValues("spec.version");
    if (availableVersions.length === 0) {
      if (currentVersion) form.setValue("spec.version", "");
      return;
    }
    if (!currentVersion || !availableVersions.includes(currentVersion)) {
      form.setValue(
        "spec.version",
        availableVersions[availableVersions.length - 1],
      );
    }
  }, [isEdit, availableVersions, form]);

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
            placeholder={t("clusters.placeholders.clusterName")}
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
    imageRegistryFields: (
      <FormCardGrid>
        <FormFieldGroup
          {...form}
          name="spec.image_registry"
          label={t("common.fields.imageRegistry")}
        >
          <FormCombobox
            placeholder={t("clusters.placeholders.selectImageRegistry")}
            options={(imageRegistries.query.data?.data || []).map((item) => ({
              label: item.metadata.name,
              value: item.metadata.name,
            }))}
            disabled={imageRegistries.query.isLoading || isEdit}
          />
        </FormFieldGroup>
      </FormCardGrid>
    ),
    versionFields: (
      <FormCardGrid>
        <FormFieldGroup
          {...form}
          name="spec.version"
          label={t("common.fields.version")}
          rules={{ required: true }}
        >
          <FormCombobox
            placeholder={t("clusters.placeholders.selectVersion")}
            options={versionOptions.map((v) => ({
              label: v,
              value: v,
            }))}
            disabled={!versionsQueryEnabled || isLoadingVersions || isEdit}
          />
        </FormFieldGroup>
      </FormCardGrid>
    ),
    typeFields: (
      <FormCardGrid title={t("clusters.sections.clusterType")}>
        <FormFieldGroup
          {...form}
          name="spec.type"
          label={t("common.fields.type")}
        >
          <FormSelect
            options={[
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
                  ssh_config: {
                    provider: {
                      head_ip: "",
                      worker_ips: [],
                    },
                    auth: {
                      ssh_user: "",
                      ssh_private_key: "",
                    },
                  },
                  model_caches: [],
                });
              } else if (value === "kubernetes") {
                form.setValue("spec.config", {
                  kubernetes_config: {
                    kubeconfig: "",
                    router: {
                      version: import.meta.env.VITE_DEFAULT_CLUSTER_VERSION,
                      access_mode: "LoadBalancer",
                      replicas: 2,
                      resources: {
                        cpu: "1",
                        memory: "1Gi",
                      },
                    },
                  },
                  model_caches: [],
                });
              }
            }}
            disabled={isEdit}
          />
        </FormFieldGroup>
      </FormCardGrid>
    ),
    providerFields: (
      <FormCardGrid title={t("clusters.sections.provider")}>
        {type === "ssh" && (
          <div className="col-span-4">
            <NodeIPsField
              control={form.control}
              name="spec.config.ssh_config.provider"
              headIpDisabled={isEdit}
            />
          </div>
        )}

        {isKubernetes && (
          <FormFieldGroup
            {...form}
            name="spec.config.kubernetes_config.kubeconfig"
            label={t("clusters.fields.kubeconfig")}
            description={
              isEdit ? t("common.messages.leaveEmptyToKeepValue") : undefined
            }
            className="col-span-4"
          >
            <Textarea disabled={isEdit} />
          </FormFieldGroup>
        )}
      </FormCardGrid>
    ),
    routerFields: isKubernetes ? (
      <FormCardGrid title={t("clusters.sections.router")}>
        <FormFieldGroup
          {...form}
          name="spec.config.kubernetes_config.router.access_mode"
          label={t("clusters.fields.accessMode")}
        >
          <FormSelect
            options={[
              {
                label: t("clusters.options.loadBalancer"),
                value: "LoadBalancer",
              },
              { label: t("clusters.options.nodePort"), value: "NodePort" },
              // not supported yet
              // { label: t("clusters.options.ingress"), value: "Ingress" },
            ]}
          />
        </FormFieldGroup>

        <FormFieldGroup
          {...form}
          name="spec.config.kubernetes_config.router.replicas"
          label={t("clusters.fields.replicas")}
        >
          <Input type="number" />
        </FormFieldGroup>

        <FormFieldGroup
          {...form}
          name="spec.config.kubernetes_config.router.resources.cpu"
          label={t("common.fields.cpu")}
        >
          <Input />
        </FormFieldGroup>

        <FormFieldGroup
          {...form}
          name="spec.config.kubernetes_config.router.resources.memory"
          label={t("common.fields.memory")}
        >
          <Input />
        </FormFieldGroup>
      </FormCardGrid>
    ) : null,
    modelCacheFields: (
      <div>
        <FormCardGrid title={t("clusters.sections.modelCaches")}>
          <ModelCacheFields form={form} disabled={isModelCacheDisabled} />
        </FormCardGrid>
      </div>
    ),
    authFields: isKubernetes ? null : (
      <FormCardGrid title={t("clusters.sections.nodeAuthentication")}>
        <FormFieldGroup
          {...form}
          name="spec.config.ssh_config.auth.ssh_user"
          label={t("clusters.fields.sshUser")}
        >
          <Input
            placeholder={t("clusters.placeholders.sshUserExample")}
            disabled={isEdit}
          />
        </FormFieldGroup>
        <FormFieldGroup
          {...form}
          name="spec.config.ssh_config.auth.ssh_private_key"
          label={t("clusters.fields.sshPrivateKey")}
          description={
            isEdit ? t("common.messages.leaveEmptyToKeepValue") : undefined
          }
        >
          <Textarea disabled={isEdit} />
        </FormFieldGroup>
      </FormCardGrid>
    ),
  };
};
