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
import { PRIVATE_MODEL_REGISTRY_TYPE } from "@/lib/constant";
import { cn } from "@/lib/utils";
import { isValidIPAddress, isValidPath } from "@/lib/validate";
import type { Cluster, HostPathCache, ImageRegistry } from "@/types";
import { useSelect } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useFieldArray } from "react-hook-form";
import { useTranslation } from "react-i18next";

export const transformValues = (values: Cluster) => {
  const transformedValues = { ...values };

  const config = transformedValues.spec?.config;

  // Transform SSH private key for SSH type clusters
  if ("auth" in config) {
    if (config.auth.ssh_private_key && values.spec.type === "ssh") {
      if (!config.auth.ssh_private_key.endsWith("\n")) {
        config.auth.ssh_private_key += "\n";
      }
      config.auth.ssh_private_key = btoa(config.auth.ssh_private_key);
    }
  }

  // Transform kubeconfig for Kubernetes type clusters
  if ("kubeconfig" in config) {
    if (config.kubeconfig && values.spec.type === "kubernetes") {
      config.kubeconfig = btoa(config.kubeconfig);
    }
  }

  return transformedValues;
};

export const useClusterForm = ({ action }: { action: "create" | "edit" }) => {
  const { t } = useTranslation();
  const { current: currentWorkspace } = useWorkspace();

  const NO_ACCELERATOR = "none";
  const acceleratorTypes = [
    { label: t("clusters.options.none"), value: NO_ACCELERATOR },
    { label: "NVIDIA GPU", value: "nvidia.com/gpu" },
    { label: "Ascend310P", value: "huawei.com/Ascend310P" },
    { label: "AMD GPU", value: "amd.com/gpu" },
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

  const originalOnFinish = form.refineCore.onFinish;
  form.refineCore.onFinish = async (values) => {
    const transformedValues = transformValues(values as Cluster);

    return originalOnFinish(transformedValues);
  };

  const workspace = form.watch("metadata.workspace");
  const type = form.watch("spec.type");
  const isKubernetes = type === "kubernetes";
  const isSSH = type === "ssh";

  const headResources = form.watch("spec.config.head_node_spec.resources");
  const workerResources = form.watch(
    "spec.config.worker_group_specs.0.resources",
  );

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "spec.config.model_caches",
  });

  const getAcceleratorTypeFromResources = (
    resources?: Record<string, string | number>,
  ) => {
    if (!resources) return NO_ACCELERATOR;
    const match = acceleratorTypes.find(
      ({ value }) => value !== NO_ACCELERATOR && resources[value],
    );
    return match?.value || NO_ACCELERATOR;
  };

  const [headAcceleratorType, setHeadAcceleratorType] = useState(() =>
    getAcceleratorTypeFromResources(headResources),
  );

  const [workerAcceleratorType, setWorkerAcceleratorType] = useState(() =>
    getAcceleratorTypeFromResources(workerResources),
  );

  const validateNodeIPs = (value: {
    head_ip: string;
    worker_ips: string[];
  }) => {
    const { head_ip, worker_ips } = value;
    return isValidIPAddress(head_ip) && !worker_ips.includes(head_ip);
  };

  const createAcceleratorState = (
    type: string,
    resources?: Record<string, string>,
  ) => ({
    type,
    count: type === NO_ACCELERATOR ? "" : resources?.[type] || "",
  });

  const headAccelerator = useMemo(
    () => createAcceleratorState(headAcceleratorType, headResources),
    [headAcceleratorType, headResources],
  );

  const workerAccelerator = useMemo(
    () => createAcceleratorState(workerAcceleratorType, workerResources),
    [workerAcceleratorType, workerResources],
  );

  const updateAcceleratorResources = (
    resourcesPath: string,
    currentResources: Record<string, string | number> | undefined,
    newType: string,
    newCount: string,
  ) => {
    if (!currentResources) return;

    const newResources = { ...currentResources };
    acceleratorTypes
      .filter((type) => type.value !== NO_ACCELERATOR)
      .forEach((type) => delete newResources[type.value]);
    if (newType !== NO_ACCELERATOR && newCount)
      newResources[newType] = newCount;

    if (resourcesPath === "spec.config.head_node_spec.resources") {
      form.setValue("spec.config.head_node_spec.resources", newResources);
    } else if (resourcesPath === "spec.config.worker_group_specs.0.resources") {
      form.setValue("spec.config.worker_group_specs.0.resources", newResources);
    }
  };

  const validateAccelerator = (type: string, count: string) => {
    if (type === NO_ACCELERATOR) return true;
    if (!count || count === "")
      return (
        t("clusters.validation.acceleratorCountRequired") ||
        "Accelerator count is required"
      );

    const numValue = Number.parseFloat(count);
    if (!Number.isInteger(numValue) || numValue <= 0) {
      return (
        t("clusters.validation.acceleratorCountInvalid") ||
        "Please enter a valid accelerator count"
      );
    }
    return true;
  };

  useEffect(() => {
    if (isKubernetes) {
      form.register("head_accelerator_count", {
        validate: () =>
          validateAccelerator(headAccelerator.type, headAccelerator.count),
      });

      form.register("worker_accelerator_count", {
        validate: () =>
          validateAccelerator(workerAccelerator.type, workerAccelerator.count),
      });

      form.trigger("head_accelerator_count");
      form.trigger("worker_accelerator_count");
    }

    // Register validation for SSH provider
    if (isSSH) {
      form.register("spec.config.provider", {
        validate: validateNodeIPs,
      });

      form.trigger("spec.config.provider");
    }
  }, [
    isKubernetes,
    isSSH,
    headAccelerator.type,
    headAccelerator.count,
    workerAccelerator.type,
    workerAccelerator.count,
    form.register,
    form.trigger,
  ]);

  const meta = {
    workspace,
  };

  const imageRegistries = useSelect<ImageRegistry>({
    resource: "image_registries",
    meta,
  });

  const isEdit = action === "edit";

  const addModelCache = () => {
    append({
      host_path: { path: "" },
      model_registry_type: "",
    } as HostPathCache); // Default to host_path with empty path
  };

  const getCacheType = (index: number): "nfs" | "host_path" => {
    const cache = form.watch(`spec.config.model_caches.${index}`);
    return cache?.nfs ? "nfs" : "host_path";
  };

  const switchCacheType = (index: number, newType: "nfs" | "host_path") => {
    if (newType === "nfs") {
      form.setValue(`spec.config.model_caches.${index}`, {
        nfs: {
          server: "",
          path: "",
        },
        model_registry_type: null,
      });
    } else {
      form.setValue(`spec.config.model_caches.${index}`, {
        host_path: {
          path: "",
        },
        model_registry_type: null,
      });
    }
  };

  const getInputErrorClasses = (hasError: boolean, baseClasses?: string) =>
    cn(baseClasses, hasError && ["border-red-500", "focus:border-red-500"]);

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
          <Field {...form} name="spec.config.provider" className="col-span-4">
            <NodeIPsField disabled={isEdit} />
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
              setHeadAcceleratorType(value);
              updateAcceleratorResources(
                "spec.config.head_node_spec.resources",
                headResources,
                value,
                value === NO_ACCELERATOR ? "" : headAccelerator.count,
              );
              form.trigger("head_accelerator_count");
            }}
            disabled={isEdit}
          />
        </Field>

        <Field
          {...form}
          name="head_accelerator_count"
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
              form.trigger("head_accelerator_count");
            }}
            className={getInputErrorClasses(
              headAccelerator.type !== NO_ACCELERATOR &&
                (!headAccelerator.count ||
                  !!form.formState.errors.head_accelerator_count),
            )}
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
              setWorkerAcceleratorType(value);
              updateAcceleratorResources(
                "spec.config.worker_group_specs.0.resources",
                workerResources,
                value,
                value === NO_ACCELERATOR ? "" : workerAccelerator.count,
              );
              form.trigger("worker_accelerator_count");
            }}
            disabled={isEdit}
          />
        </Field>

        <Field
          {...form}
          name="worker_accelerator_count"
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
              form.trigger("worker_accelerator_count");
            }}
            className={getInputErrorClasses(
              workerAccelerator.type !== NO_ACCELERATOR &&
                (!workerAccelerator.count ||
                  !!form.formState.errors.worker_accelerator_count),
            )}
          />
        </Field>

        <div />
        <div />
      </FormCardGrid>
    ) : null,
    modelCacheFields: (
      <div>
        <FormCardGrid title={t("clusters.sections.modelCaches")}>
          <div className="col-span-full space-y-4">
            {fields.map((field, index) => {
              const cacheType = getCacheType(index);

              return (
                <Card key={field.id} className="relative">
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
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
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
                              value as "nfs" | "host_path",
                            );
                          }}
                        />
                      </div>

                      <Field
                        label={t("clusters.fields.modelCache.modelRegistry")}
                        {...form.register(
                          `spec.config.model_caches.${index}.model_registry_type`,
                          {
                            required: {
                              value: true,
                              message:
                                t(
                                  "clusters.validation.modelRegistryRequired",
                                ) || "Model registry type is required",
                            },
                          },
                        )}
                      >
                        <Select
                          options={[
                            {
                              label: t("model_registries.types.huggingFace"),
                              value: "hugging-face",
                            },
                            {
                              label: t("model_registries.types.fileSystem"),
                              value: PRIVATE_MODEL_REGISTRY_TYPE,
                            },
                          ]}
                        />
                      </Field>
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
                                !!form.formState.errors[
                                  `spec.config.model_caches.${index}.nfs.server`
                                ],
                              )}
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
                              placeholder="/path/to/cache"
                              className={getInputErrorClasses(
                                !!form.formState.errors[
                                  `spec.config.model_caches.${index}.nfs.path`
                                ],
                              )}
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
                            placeholder="/path/to/cache"
                            className={getInputErrorClasses(
                              !!form.formState.errors[
                                `spec.config.model_caches.${index}.host_path.path`
                              ],
                              "col-span-2",
                            )}
                          />
                        </Field>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {fields.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                {t("clusters.messages.noModelCaches")}
              </div>
            )}
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
          </div>
        </FormCardGrid>
      </div>
    ),
    authFields: isKubernetes ? null : (
      <FormCardGrid title={t("clusters.sections.nodeAuthentication")}>
        <Field
          {...form}
          name="spec.config.auth.ssh_user"
          label={t("clusters.fields.sshUser")}
        >
          <Input
            placeholder={t("clusters.placeholders.sshUserExample")}
            disabled={isEdit}
          />
        </Field>
        <Field
          {...form}
          name="spec.config.auth.ssh_private_key"
          label={t("clusters.fields.sshPrivateKey")}
        >
          <Textarea disabled={isEdit} />
        </Field>
      </FormCardGrid>
    ),
  };
};
