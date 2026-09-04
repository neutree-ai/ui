import { useSelect } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import ModelMappingEditor from "@/domains/external-endpoint/components/ModelMappingEditor";
import TestConnectivityButton from "@/domains/external-endpoint/components/TestConnectivityButton";
import TimeoutInput from "@/domains/external-endpoint/components/TimeoutInput";
import { useTestConnectivity } from "@/domains/external-endpoint/hooks/use-test-connectivity";
import { cleanUpstreamsForSubmit } from "@/domains/external-endpoint/lib/clean-upstreams-for-submit";
import type { UpstreamType } from "@/domains/external-endpoint/lib/derive-upstream-type";
import { deriveUpstreamType } from "@/domains/external-endpoint/lib/derive-upstream-type";
import type {
  ExternalEndpoint,
  ModelRoute,
  ModelRouteTarget,
  UpstreamSpec,
} from "@/domains/external-endpoint/types";
import EndpointStatus from "@/foundation/components/EndpointStatus";
import FormCardGrid from "@/foundation/components/FormCardGrid";
import { FormCombobox } from "@/foundation/components/FormCombobox";
import { FormFieldGroup } from "@/foundation/components/FormFieldGroup";
import { FormSelect } from "@/foundation/components/FormSelect";
import WorkspaceField from "@/foundation/components/WorkspaceField";
import { useRefineFieldArray } from "@/foundation/hooks/use-refine-field-array";
import {
  isValidWorkspace,
  useWorkspace,
} from "@/foundation/hooks/use-workspace";
import { useTranslation } from "@/foundation/lib/i18n";

const emptyExternalUpstream: UpstreamSpec = {
  name: "",
  upstream: { url: "" },
  auth: { type: "bearer", credential: "" },
  model_mapping: {},
  models: null,
};

const emptyModelRoute = (): ModelRoute => ({
  model: "",
  strategy: "weighted_random",
  targets: [{ upstream: "", upstream_model: "", weight: 1 }],
});

export const useExternalEndpointForm = ({
  action,
}: {
  action: "create" | "edit";
}) => {
  const { t } = useTranslation();
  const { current: currentWorkspace } = useWorkspace();
  const form = useForm<ExternalEndpoint>({
    mode: "all",
    defaultValues: {
      api_version: "v1",
      kind: "ExternalEndpoint",
      metadata: {
        name: "",
        workspace: isValidWorkspace(currentWorkspace) ? currentWorkspace : "",
      },
      spec: {
        route_type: "/v1/chat/completions",
        timeout: 60000,
        upstreams: action === "create" ? [{ ...emptyExternalUpstream }] : [],
        model_routes: [],
      },
    },
    refineCoreProps: {
      queryOptions: {
        // Disable stale cache on mount so useFieldArray always initializes
        // with fresh data after an edit-save-edit cycle.
        cacheTime: 0,
      },
    },
    warnWhenUnsavedChanges: true,
  });

  const { fields, append, remove } = useRefineFieldArray({
    control: form.control,
    name: "spec.upstreams",
    refineForm: form,
  });

  const isEdit = action === "edit";

  // Models returned by test connectivity, keyed by upstream index
  const [availableModelsMap, setAvailableModelsMap] = useState<
    Record<number, string[]>
  >({});
  const connectivity = useTestConnectivity();

  // Derive upstream types from form data — no separate state needed
  const upstreams = form.watch("spec.upstreams") as UpstreamSpec[] | undefined;
  const modelRoutes =
    (form.watch("spec.model_routes") as ModelRoute[] | undefined) ?? [];

  const updateModelRoutes = useCallback(
    (next: ModelRoute[]) => {
      form.setValue("spec.model_routes", next, {
        shouldDirty: true,
        shouldValidate: true,
      });
    },
    [form],
  );

  const addModelRoute = () =>
    updateModelRoutes([...modelRoutes, emptyModelRoute()]);
  const removeModelRoute = (index: number) =>
    updateModelRoutes(
      modelRoutes.filter(
        (_: ModelRoute, routeIndex: number) => routeIndex !== index,
      ),
    );
  const addRouteTarget = (routeIndex: number) => {
    const next = modelRoutes.map((route: ModelRoute, index: number) =>
      index === routeIndex
        ? {
            ...route,
            targets: [
              ...route.targets,
              { upstream: "", upstream_model: "", weight: 1 },
            ],
          }
        : route,
    );
    updateModelRoutes(next);
  };
  const removeRouteTarget = (routeIndex: number, targetIndex: number) => {
    const next = modelRoutes.map((route: ModelRoute, index: number) =>
      index === routeIndex
        ? {
            ...route,
            targets: route.targets.filter(
              (_: ModelRouteTarget, index: number) => index !== targetIndex,
            ),
          }
        : route,
    );
    updateModelRoutes(next);
  };

  /** Auto-load models when an endpoint_ref is selected in the combobox */
  const handleEndpointRefChange = useCallback(
    async (index: number, endpointRef: string) => {
      if (!endpointRef) return;
      const data = await connectivity.test(index, {
        type: "endpoint_ref",
        endpoint_ref: endpointRef,
        workspace: currentWorkspace,
      });
      if (data.success && data.models?.length) {
        const models = data.models;
        setAvailableModelsMap((prev) => ({
          ...prev,
          [index]: models,
        }));
        // Auto-fill model mapping from the selected endpoint ref's models
        const mapping: Record<string, string> = {};
        for (const model of models) {
          mapping[model] = model;
        }
        form.setValue(`spec.upstreams.${index}.model_mapping`, mapping);
      }
    },
    [connectivity, currentWorkspace, form],
  );

  const handleUpstreamTypeChange = useCallback(
    (index: number, newType: UpstreamType) => {
      if (newType === "endpoint_ref") {
        form.setValue(`spec.upstreams.${index}.upstream`, null);
        form.setValue(`spec.upstreams.${index}.auth`, null);
        form.setValue(`spec.upstreams.${index}.endpoint_ref`, "");
      } else {
        form.setValue(`spec.upstreams.${index}.endpoint_ref`, undefined);
        form.setValue(`spec.upstreams.${index}.upstream`, { url: "" });
        form.setValue(`spec.upstreams.${index}.auth`, {
          type: "bearer",
          credential: "",
        });
      }
      // Clear model mapping and available models when switching upstream type
      form.setValue(`spec.upstreams.${index}.model_mapping`, {});
      setAvailableModelsMap((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
    },
    [form],
  );

  // Fetch internal endpoints for the combobox
  const endpoints = useSelect({
    resource: "endpoints",
    meta: { workspace: currentWorkspace },
  });

  const endpointOptions = (endpoints.query.data?.data || [])
    .map((item) => {
      const phase = (item as { status?: { phase?: string } }).status?.phase;
      return {
        label: item.metadata.name,
        value: item.metadata.name,
        phase,
        status: (item as { status?: { phase?: string } }).status,
      };
    })
    .sort((a, b) => {
      const aRunning = a.phase === "Running" ? 0 : 1;
      const bRunning = b.phase === "Running" ? 0 : 1;
      return aRunning - bRunning;
    });

  const originalOnFinish = form.refineCore.onFinish;
  form.refineCore.onFinish = async (values) => {
    const v = values as ExternalEndpoint;
    if (v.spec?.upstreams) {
      v.spec.upstreams = cleanUpstreamsForSubmit(
        v.spec.upstreams,
        isEdit,
        form.formState.touchedFields.spec?.upstreams,
      );
    }
    return originalOnFinish(v);
  };

  return {
    form,
    metadataFields: (
      <FormCardGrid title={t("common.sections.basicInformation")}>
        <FormFieldGroup
          {...form}
          label={t("common.fields.name")}
          {...form.register("metadata.name", {
            required: {
              value: true,
              message: t("external_endpoints.validation.nameRequired"),
            },
          })}
        >
          <Input
            placeholder={t("external_endpoints.placeholders.endpointName")}
            disabled={isEdit}
          />
        </FormFieldGroup>
        <FormFieldGroup
          {...form}
          name="metadata.workspace"
          label={t("common.fields.workspace")}
          rules={{
            required: t("common.validation.workspaceRequired"),
            validate: (value: string) =>
              isValidWorkspace(value) ||
              t("common.validation.workspaceRequired"),
          }}
        >
          <WorkspaceField disabled={isEdit} />
        </FormFieldGroup>
      </FormCardGrid>
    ),
    specFields: (
      <>
        <FormCardGrid title={t("external_endpoints.sections.configuration")}>
          <FormFieldGroup
            {...form}
            name="spec.timeout"
            label={t("external_endpoints.fields.timeout")}
          >
            <TimeoutInput />
          </FormFieldGroup>
        </FormCardGrid>
        {fields.map((field, index) => {
          const currentType = deriveUpstreamType(upstreams?.[index]);
          return (
            <Card key={field.id} className="border-border/60 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between py-2 px-4">
                <CardTitle>
                  {t("external_endpoints.sections.upstream", {
                    index: index + 1,
                  })}
                </CardTitle>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(index)}
                  disabled={fields.length <= 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-4 py-2 px-4">
                <div className="grid grid-cols-5 gap-x-5 gap-y-4 xs:grid-cols-1">
                  <FormFieldGroup
                    {...form}
                    label={t("external_endpoints.fields.providerName")}
                    className="col-span-1 xs:col-span-1"
                    {...form.register(`spec.upstreams.${index}.name`, {
                      required: modelRoutes.length > 0,
                    })}
                  >
                    <Input
                      placeholder={t(
                        "external_endpoints.placeholders.providerName",
                      )}
                    />
                  </FormFieldGroup>
                  <FormFieldGroup
                    {...form}
                    name={`_upstreamType_${index}`}
                    label={t("external_endpoints.fields.upstreamType")}
                  >
                    <FormSelect
                      value={currentType}
                      onChange={(value) =>
                        handleUpstreamTypeChange(index, value as UpstreamType)
                      }
                      options={[
                        {
                          label: t(
                            "external_endpoints.options.upstreamTypeExternal",
                          ),
                          value: "external",
                        },
                        {
                          label: t(
                            "external_endpoints.options.upstreamTypeEndpointRef",
                          ),
                          value: "endpoint_ref",
                        },
                      ]}
                    />
                  </FormFieldGroup>
                  {currentType === "external" ? (
                    <>
                      <FormFieldGroup
                        {...form}
                        label={t("external_endpoints.fields.upstreamUrl")}
                        {...form.register(
                          `spec.upstreams.${index}.upstream.url`,
                          {
                            required: {
                              value: true,
                              message: t(
                                "external_endpoints.validation.upstreamUrlRequired",
                              ),
                            },
                          },
                        )}
                      >
                        <Input
                          placeholder={t(
                            "external_endpoints.placeholders.upstreamUrl",
                          )}
                        />
                      </FormFieldGroup>
                      <input
                        type="hidden"
                        {...form.register(`spec.upstreams.${index}.auth.type`)}
                      />
                      <FormFieldGroup
                        {...form}
                        name={`spec.upstreams.${index}.auth.credential`}
                        label={t("external_endpoints.fields.credential")}
                        className="col-span-2 xs:col-span-1"
                        description={
                          isEdit
                            ? t("common.messages.leaveEmptyToKeepValue")
                            : undefined
                        }
                      >
                        <Input
                          type="password"
                          placeholder={t(
                            "external_endpoints.placeholders.credential",
                          )}
                        />
                      </FormFieldGroup>
                      <div className="col-span-5 flex items-center xs:col-span-1">
                        <TestConnectivityButton
                          testing={connectivity.testingMap[index] ?? false}
                          result={connectivity.resultMap[index] ?? null}
                          onTest={async () => {
                            const url =
                              form.getValues(
                                `spec.upstreams.${index}.upstream.url`,
                              ) ?? "";
                            const credential =
                              form.getValues(
                                `spec.upstreams.${index}.auth.credential`,
                              ) ?? "";
                            const name = isEdit
                              ? (form.getValues("metadata.name") ?? "")
                              : "";
                            const storedUpstreamUrl = isEdit
                              ? ((
                                  form.refineCore.query?.data?.data as
                                    | ExternalEndpoint
                                    | undefined
                                )?.spec?.upstreams?.[index]?.upstream?.url ??
                                "")
                              : "";
                            const data = await connectivity.test(index, {
                              type: "external",
                              url,
                              credential,
                              ...(isEdit
                                ? {
                                    name,
                                    workspace: currentWorkspace,
                                    stored_upstream_url: storedUpstreamUrl,
                                  }
                                : {}),
                            });
                            if (data.success && data.models?.length) {
                              const models = data.models;
                              setAvailableModelsMap((prev) => ({
                                ...prev,
                                [index]: models,
                              }));
                            }
                          }}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <FormFieldGroup
                        {...form}
                        name={`spec.upstreams.${index}.endpoint_ref`}
                        label={t("external_endpoints.fields.endpointRef")}
                        className="col-span-3 xs:col-span-1"
                      >
                        <FormCombobox
                          placeholder={t(
                            "external_endpoints.placeholders.selectEndpointRef",
                          )}
                          options={endpointOptions}
                          renderOption={(option) => {
                            const endpoint =
                              option as (typeof endpointOptions)[number];
                            return (
                              <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                                <span className="truncate">
                                  {endpoint.label}
                                </span>
                                {endpoint.status?.phase ? (
                                  <span className="shrink-0">
                                    <EndpointStatus {...endpoint.status} />
                                  </span>
                                ) : null}
                              </span>
                            );
                          }}
                          onChange={(val) => {
                            const ref = String(val);
                            form.setValue(
                              `spec.upstreams.${index}.endpoint_ref`,
                              ref,
                            );
                            handleEndpointRefChange(index, ref);
                          }}
                        />
                      </FormFieldGroup>
                      <div className="col-span-5 flex items-center xs:col-span-1">
                        <TestConnectivityButton
                          testing={connectivity.testingMap[index] ?? false}
                          result={connectivity.resultMap[index] ?? null}
                          onTest={async () => {
                            const endpointRef =
                              form.getValues(
                                `spec.upstreams.${index}.endpoint_ref`,
                              ) ?? "";
                            const data = await connectivity.test(index, {
                              type: "endpoint_ref",
                              endpoint_ref: endpointRef,
                              workspace: currentWorkspace,
                            });
                            if (data.success && data.models?.length) {
                              const models = data.models;
                              setAvailableModelsMap((prev) => ({
                                ...prev,
                                [index]: models,
                              }));
                            }
                          }}
                        />
                      </div>
                    </>
                  )}
                </div>
                {modelRoutes.length === 0 && (
                  <div>
                    <FormFieldGroup
                      {...form}
                      name={`spec.upstreams.${index}.model_mapping`}
                      label={t("external_endpoints.fields.modelMapping")}
                      className="col-span-4"
                    >
                      <ModelMappingEditor
                        availableModels={availableModelsMap[index]}
                      />
                    </FormFieldGroup>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        <Button
          type="button"
          variant="outline"
          onClick={() => append({ ...emptyExternalUpstream })}
          className="w-full"
        >
          <Plus className="mr-1 h-4 w-4" />
          {t("external_endpoints.actions.addUpstream")}
        </Button>
        <FormCardGrid title={t("external_endpoints.sections.modelRoutes")}>
          <div className="col-span-full space-y-4">
            {modelRoutes.map((route: ModelRoute, routeIndex: number) => (
              <div
                key={routeIndex}
                className="border-b border-border/60 pb-4 last:border-0"
              >
                <div className="flex items-center justify-between py-2">
                  <h3 className="text-sm font-semibold">
                    {t("external_endpoints.sections.modelRoute", {
                      index: routeIndex + 1,
                    })}
                  </h3>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeModelRoute(routeIndex)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-3 py-2">
                  <FormFieldGroup
                    {...form}
                    label={t("external_endpoints.fields.exposedModelName")}
                    {...form.register(`spec.model_routes.${routeIndex}.model`, {
                      required: true,
                    })}
                  >
                    <Input
                      placeholder={t(
                        "external_endpoints.placeholders.exposedModelName",
                      )}
                    />
                  </FormFieldGroup>
                  <div className="grid grid-cols-[1fr_1fr_100px_100px_140px_auto] gap-3 text-xs font-medium text-muted-foreground xs:grid-cols-1">
                    <span>{t("external_endpoints.fields.providerName")}</span>
                    <span>
                      {t("external_endpoints.fields.upstreamModelName")}
                    </span>
                    <span>{t("external_endpoints.fields.priority")}</span>
                    <span>{t("external_endpoints.fields.weight")}</span>
                    <span>
                      {t("external_endpoints.fields.maxInflightRequests")}
                    </span>
                    <span />
                  </div>
                  {route.targets.map(
                    (target: ModelRouteTarget, targetIndex: number) => (
                      <div
                        key={targetIndex}
                        className="grid grid-cols-[1fr_1fr_100px_100px_140px_auto] gap-3 xs:grid-cols-1"
                      >
                        <FormSelect
                          value={target.upstream}
                          onChange={(value) => {
                            const next = modelRoutes.map(
                              (item: ModelRoute, index: number) =>
                                index === routeIndex
                                  ? {
                                      ...item,
                                      targets: item.targets.map(
                                        (
                                          itemTarget: ModelRouteTarget,
                                          index: number,
                                        ) =>
                                          index === targetIndex
                                            ? {
                                                ...itemTarget,
                                                upstream: String(value),
                                              }
                                            : itemTarget,
                                      ),
                                    }
                                  : item,
                            );
                            updateModelRoutes(next);
                          }}
                          options={(upstreams ?? [])
                            .filter((upstream) => upstream.name)
                            .map((upstream: UpstreamSpec) => ({
                              label: upstream.name as string,
                              value: upstream.name as string,
                            }))}
                        />
                        <Input
                          {...form.register(
                            `spec.model_routes.${routeIndex}.targets.${targetIndex}.upstream_model`,
                            { required: true },
                          )}
                          placeholder={t(
                            "external_endpoints.placeholders.upstreamModelName",
                          )}
                        />
                        <Input
                          type="number"
                          min={0}
                          {...form.register(
                            `spec.model_routes.${routeIndex}.targets.${targetIndex}.priority`,
                            { valueAsNumber: true },
                          )}
                        />
                        <Input
                          type="number"
                          min={1}
                          {...form.register(
                            `spec.model_routes.${routeIndex}.targets.${targetIndex}.weight`,
                            { valueAsNumber: true, min: 1 },
                          )}
                        />
                        <Input
                          type="number"
                          min={0}
                          {...form.register(
                            `spec.model_routes.${routeIndex}.targets.${targetIndex}.max_inflight_requests`,
                            { valueAsNumber: true, min: 0 },
                          )}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            removeRouteTarget(routeIndex, targetIndex)
                          }
                          disabled={route.targets.length <= 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ),
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addRouteTarget(routeIndex)}
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    {t("external_endpoints.actions.addRouteTarget")}
                  </Button>
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={addModelRoute}>
              <Plus className="mr-1 h-4 w-4" />
              {t("external_endpoints.actions.addModelRoute")}
            </Button>
          </div>
        </FormCardGrid>
      </>
    ),
  };
};
