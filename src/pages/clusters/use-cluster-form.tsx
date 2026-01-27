import FormCardGrid from "@/components/business/FormCardGrid";
import NodeIPsField from "@/components/business/NodeIPsField";
import WorkspaceField from "@/components/business/WorkspaceField";
import { Combobox, Field, Select } from "@/components/theme";
import { useWorkspace } from "@/components/theme/hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { isValidIPAddress, isValidPath } from "@/lib/validate";
import type { Cluster, ImageRegistry } from "@/types";
import { useSelect } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { useEffect } from "react";
import { useFieldArray } from "react-hook-form";
import { useTranslation } from "react-i18next";

export const transformValues = (values: Cluster, isEdit = false) => {
  const transformedValues = { ...values };

  const config = transformedValues.spec?.config;

  // Transform SSH private key for SSH type clusters
  if (config.ssh_config?.auth?.ssh_private_key && values.spec.type === "ssh") {
    if (!config.ssh_config.auth.ssh_private_key.endsWith("\n")) {
      config.ssh_config.auth.ssh_private_key += "\n";
    }
    config.ssh_config.auth.ssh_private_key = btoa(
      config.ssh_config.auth.ssh_private_key,
    );
  }

  // Transform kubeconfig for Kubernetes type clusters
  if (
    config.kubernetes_config?.kubeconfig &&
    values.spec.type === "kubernetes"
  ) {
    config.kubernetes_config.kubeconfig = btoa(
      config.kubernetes_config.kubeconfig,
    );
  }

  // Transform router replicas to number
  if (config.kubernetes_config?.router?.replicas) {
    config.kubernetes_config.router.replicas = Number(
      config.kubernetes_config.router.replicas,
    );
  }

  // In edit mode, remove empty sensitive fields to avoid overwriting backend config
  if (isEdit) {
    if (config.ssh_config?.auth && !config.ssh_config.auth.ssh_private_key) {
      delete config.ssh_config.auth.ssh_private_key;
    }
    if (config.kubernetes_config && !config.kubernetes_config.kubeconfig) {
      delete config.kubernetes_config.kubeconfig;
    }
  }

  return transformedValues;
};

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
    const transformedValues = transformValues(values as Cluster, isEdit);

    return originalOnFinish(transformedValues);
  };

  const workspace = form.watch("metadata.workspace");
  const type = form.watch("spec.type");
  const isKubernetes = type === "kubernetes";
  const isSSH = type === "ssh";
  const isModelCacheDisabled = isEdit && isSSH;

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "spec.config.model_caches",
  });

  // Fix for https://github.com/refinedev/refine/issues/5894
  // Use watch to get current values instead of relying on fields directly
  const modelCaches: { name: string }[] =
    form.watch("spec.config.model_caches") || [];

  const validateNodeIPs = (value: {
    head_ip: string;
    worker_ips: string[];
  }) => {
    const { head_ip, worker_ips } = value;
    return isValidIPAddress(head_ip) && !(worker_ips || []).includes(head_ip);
  };

  // Kubernetes storage quantity validation
  const validateStorageQuantity = (value: string) => {
    if (!value) return true;
    const storageRegex = /^\d+(\.\d+)?(Ki|Mi|Gi|Ti|Pi|Ei|K|M|G|T|P|E)?$/;
    if (storageRegex.test(value)) {
      return true;
    }
    return (
      t("clusters.validation.invalidStorageFormat") ||
      "Invalid storage format (e.g., 10Gi, 100Mi)"
    );
  };

  useEffect(() => {
    // Register validation for SSH provider
    if (isSSH) {
      form.register("spec.config.ssh_config.provider", {
        validate: validateNodeIPs,
      });

      form.trigger("spec.config.ssh_config.provider");
    }
  }, [isSSH, form.register, form.trigger]);

  const meta = {
    workspace,
  };

  const imageRegistries = useSelect<ImageRegistry>({
    resource: "image_registries",
    meta,
  });

  const addModelCache = () => {
    append({
      name: "",
      host_path: { path: "" },
    });
  };

  const getCacheType = (index: number): "nfs" | "host_path" | "pvc" => {
    const cache = form.watch(`spec.config.model_caches.${index}`);
    if (cache?.nfs) return "nfs";
    if (cache?.pvc) return "pvc";
    return "host_path";
  };

  const switchCacheType = (
    index: number,
    newType: "nfs" | "host_path" | "pvc",
  ) => {
    const currentCache = form.watch(`spec.config.model_caches.${index}`);
    const name = currentCache?.name || "";

    if (newType === "nfs") {
      form.setValue(`spec.config.model_caches.${index}`, {
        name,
        nfs: {
          server: "",
          path: "",
        },
      });
    } else if (newType === "pvc") {
      form.setValue(`spec.config.model_caches.${index}`, {
        name,
        pvc: {
          accessModes: ["ReadWriteMany"],
          resources: {
            requests: {
              storage: "500Gi",
            },
          },
        },
      });
    } else {
      form.setValue(`spec.config.model_caches.${index}`, {
        name,
        host_path: {
          path: "",
        },
      });
    }
  };

  const getInputErrorClasses = (hasError: boolean, baseClasses?: string) =>
    cn(baseClasses, hasError && ["border-red-500", "focus:border-red-500"]);

  return {
    form,
    metadataFields: (
      <FormCardGrid title={t("common.sections.basicInformation")}>
        <Field {...form} name="metadata.name" label={t("common.fields.name")}>
          <Input
            placeholder={t("clusters.placeholders.clusterName")}
            disabled={isEdit}
          />
        </Field>
        <Field
          {...form}
          name="metadata.workspace"
          label={t("common.fields.workspace")}
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
          label={t("common.fields.imageRegistry")}
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
        <Field {...form} name="spec.type" label={t("common.fields.type")}>
          <Select
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
        </Field>
      </FormCardGrid>
    ),
    providerFields: (
      <FormCardGrid title={t("clusters.sections.provider")}>
        {type === "ssh" && (
          <Field
            {...form}
            name="spec.config.ssh_config.provider"
            className="col-span-4"
          >
            <NodeIPsField disabled={isEdit} />
          </Field>
        )}

        {isKubernetes && (
          <Field
            {...form}
            name="spec.config.kubernetes_config.kubeconfig"
            label={t("clusters.fields.kubeconfig")}
            description={
              isEdit ? t("common.messages.leaveEmptyToKeepValue") : undefined
            }
            className="col-span-4"
          >
            <Textarea disabled={isEdit} />
          </Field>
        )}
      </FormCardGrid>
    ),
    routerFields: isKubernetes ? (
      <FormCardGrid title={t("clusters.sections.router")}>
        <Field
          {...form}
          name="spec.config.kubernetes_config.router.access_mode"
          label={t("clusters.fields.accessMode")}
        >
          <Select
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
        </Field>

        <Field
          {...form}
          name="spec.config.kubernetes_config.router.replicas"
          label={t("clusters.fields.replicas")}
        >
          <Input type="number" />
        </Field>

        <Field
          {...form}
          name="spec.config.kubernetes_config.router.resources.cpu"
          label={t("common.fields.cpu")}
        >
          <Input />
        </Field>

        <Field
          {...form}
          name="spec.config.kubernetes_config.router.resources.memory"
          label={t("common.fields.memory")}
        >
          <Input />
        </Field>
      </FormCardGrid>
    ) : null,
    modelCacheFields: (
      <div>
        <FormCardGrid title={t("clusters.sections.modelCaches")}>
          <div className="col-span-full space-y-4">
            {modelCaches.map((_, index) => {
              const cacheType = getCacheType(index);

              return (
                <Card key={fields[index]?.id} className="relative">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">
                        #{index + 1} -{" "}
                        {t(`clusters.fields.modelCache.type.${cacheType}`)}
                      </CardTitle>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(index)}
                        className="text-red-500 hover:text-red-700"
                        disabled={isModelCacheDisabled}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <Field
                        label={t("common.fields.name")}
                        {...form.register(
                          `spec.config.model_caches.${index}.name`,
                        )}
                      >
                        <Input
                          placeholder={t(
                            "clusters.placeholders.modelCacheName",
                          )}
                          className={getInputErrorClasses(
                            !!(form.formState.errors.spec as any)?.config
                              ?.model_caches?.[index]?.name,
                          )}
                          disabled={isModelCacheDisabled}
                        />
                      </Field>

                      <div className="space-y-2">
                        <Label className="text-sm font-medium">
                          {t("clusters.fields.modelCache.cacheType")}
                        </Label>
                        <Select
                          options={
                            isKubernetes
                              ? [
                                  {
                                    label: t("clusters.options.hostPath"),
                                    value: "host_path",
                                  },
                                  {
                                    label: t("clusters.options.nfs"),
                                    value: "nfs",
                                  },
                                  {
                                    label: t("clusters.options.pvc"),
                                    value: "pvc",
                                  },
                                ]
                              : [
                                  {
                                    label: t("clusters.options.hostPath"),
                                    value: "host_path",
                                  },
                                ]
                          }
                          value={cacheType}
                          onChange={(value) => {
                            switchCacheType(
                              index,
                              value as "nfs" | "host_path" | "pvc",
                            );
                          }}
                          disabled={isModelCacheDisabled}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {cacheType === "nfs" && (
                        <>
                          <Field
                            label={t("clusters.fields.modelCache.nfsServer")}
                            {...form.register(
                              `spec.config.model_caches.${index}.nfs.server`,
                              {
                                required: {
                                  value: true,
                                  message:
                                    t(
                                      "clusters.validation.nfsServerRequired",
                                    ) || "NFS server is required",
                                },
                                validate: (value: string) => {
                                  if (!value) return true; // Let required rule handle empty values
                                  return (
                                    isValidIPAddress(value) ||
                                    t("clusters.validation.invalidIPAddress") ||
                                    "Please enter a valid IP address"
                                  );
                                },
                              },
                            )}
                          >
                            <Input
                              className={getInputErrorClasses(
                                !!(form.formState.errors.spec as any)?.config
                                  ?.model_caches?.[index]?.nfs?.server,
                              )}
                              disabled={isModelCacheDisabled}
                            />
                          </Field>

                          <Field
                            label={t("clusters.fields.modelCache.cachePath")}
                            {...form.register(
                              `spec.config.model_caches.${index}.nfs.path`,
                              {
                                required: {
                                  value: true,
                                  message:
                                    t(
                                      "clusters.validation.cachePathRequired",
                                    ) || "Cache path is required",
                                },
                                validate: (value: string) => {
                                  if (!value) return true; // Let required rule handle empty values
                                  return (
                                    isValidPath(value) ||
                                    t("clusters.validation.invalidPath") ||
                                    "Please enter a valid path (e.g., /path/to/cache)"
                                  );
                                },
                              },
                            )}
                          >
                            <Input
                              placeholder={t("clusters.placeholders.cachePath")}
                              className={getInputErrorClasses(
                                !!(form.formState.errors.spec as any)?.config
                                  ?.model_caches?.[index]?.nfs?.path,
                              )}
                              disabled={isModelCacheDisabled}
                            />
                          </Field>
                        </>
                      )}

                      {cacheType === "host_path" && (
                        <Field
                          label={t("clusters.fields.modelCache.cachePath")}
                          {...form.register(
                            `spec.config.model_caches.${index}.host_path.path`,
                            {
                              required: {
                                value: true,
                                message:
                                  t("clusters.validation.cachePathRequired") ||
                                  "Cache path is required",
                              },
                              validate: (value: string) => {
                                if (!value) return true;
                                return (
                                  isValidPath(value) ||
                                  t("clusters.validation.invalidPath") ||
                                  "Please enter a valid path (e.g., /dir/cache)"
                                );
                              },
                            },
                          )}
                        >
                          <Input
                            placeholder={t("clusters.placeholders.cachePath")}
                            className={getInputErrorClasses(
                              !!(form.formState.errors.spec as any)?.config
                                ?.model_caches?.[index]?.host_path?.path,
                              "col-span-2",
                            )}
                            disabled={isModelCacheDisabled}
                          />
                        </Field>
                      )}

                      {cacheType === "pvc" && (
                        <>
                          <Field
                            label={t("clusters.fields.modelCache.storage")}
                            {...form.register(
                              `spec.config.model_caches.${index}.pvc.resources.requests.storage`,
                              {
                                required: {
                                  value: true,
                                  message:
                                    t("clusters.validation.storageRequired") ||
                                    "Storage is required",
                                },
                                validate: validateStorageQuantity,
                              },
                            )}
                          >
                            <Input
                              placeholder={t("clusters.placeholders.storage")}
                              className={getInputErrorClasses(
                                !!(form.formState.errors.spec as any)?.config
                                  ?.model_caches?.[index]?.pvc?.resources
                                  ?.requests?.storage,
                              )}
                              disabled={isModelCacheDisabled}
                            />
                          </Field>

                          <Field
                            label={t(
                              "clusters.fields.modelCache.storageClassName",
                            )}
                            {...form.register(
                              `spec.config.model_caches.${index}.pvc.storageClassName`,
                            )}
                          >
                            <Input
                              placeholder={t(
                                "clusters.placeholders.storageClassName",
                              )}
                              className={getInputErrorClasses(
                                !!(form.formState.errors.spec as any)?.config
                                  ?.model_caches?.[index]?.pvc
                                  ?.storageClassName,
                              )}
                              disabled={isModelCacheDisabled}
                            />
                          </Field>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {modelCaches.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                {t("clusters.messages.noModelCaches")}
              </div>
            )}
            {modelCaches.length < 1 && !isModelCacheDisabled && (
              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addModelCache}
                  className="flex ml-auto gap-2"
                >
                  <Plus className="h-4 w-4" />
                  {t("clusters.actions.addModelCache")}
                </Button>
              </div>
            )}
          </div>
        </FormCardGrid>
      </div>
    ),
    authFields: isKubernetes ? null : (
      <FormCardGrid title={t("clusters.sections.nodeAuthentication")}>
        <Field
          {...form}
          name="spec.config.ssh_config.auth.ssh_user"
          label={t("clusters.fields.sshUser")}
        >
          <Input
            placeholder={t("clusters.placeholders.sshUserExample")}
            disabled={isEdit}
          />
        </Field>
        <Field
          {...form}
          name="spec.config.ssh_config.auth.ssh_private_key"
          label={t("clusters.fields.sshPrivateKey")}
          description={
            isEdit ? t("common.messages.leaveEmptyToKeepValue") : undefined
          }
        >
          <Textarea disabled={isEdit} />
        </Field>
      </FormCardGrid>
    ),
  };
};
