import { useSelect } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import ModelRouteEditor from "@/domains/external-endpoint/components/ModelRouteEditor";
import TestConnectivityButton from "@/domains/external-endpoint/components/TestConnectivityButton";
import TimeoutInput from "@/domains/external-endpoint/components/TimeoutInput";
import { useTestConnectivity } from "@/domains/external-endpoint/hooks/use-test-connectivity";
import { cleanUpstreamsForSubmit } from "@/domains/external-endpoint/lib/clean-upstreams-for-submit";
import type { UpstreamType } from "@/domains/external-endpoint/lib/derive-upstream-type";
import { deriveUpstreamType } from "@/domains/external-endpoint/lib/derive-upstream-type";
import type {
  ExternalEndpoint,
  ModelRoute,
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
  upstream: { url: "" },
  auth: { type: "bearer", credential: "" },
  model_mapping: {},
  models: null,
};

function routesFromLegacy(upstreams: UpstreamSpec[]): ModelRoute[] {
  const routes: ModelRoute[] = [];
  const seen = new Set<string>();
  for (const [index, upstream] of upstreams.entries()) {
    for (const [model, upstreamModel] of Object.entries(
      upstream.model_mapping ?? {},
    )) {
      if (seen.has(model)) continue;
      seen.add(model);
      routes.push({
        model,
        targets: [
          {
            upstream: upstream.name || `provider-${index + 1}`,
            upstream_model: upstreamModel,
            priority: 0,
            weight: 1,
          },
        ],
      });
    }
  }
  return routes;
}

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

  const connectivity = useTestConnectivity();

  // Derive upstream types from form data — no separate state needed
  const upstreams = form.watch("spec.upstreams");
  const modelRoutes = form.watch("spec.model_routes");
  const effectiveModelRoutes = modelRoutes ?? routesFromLegacy(upstreams ?? []);
  const providerNameSnapshot = useRef<Record<number, string>>({});

  useEffect(() => {
    for (const [index, upstream] of (upstreams ?? []).entries()) {
      if (providerNameSnapshot.current[index] === undefined) {
        providerNameSnapshot.current[index] =
          upstream.name || `provider-${index + 1}`;
      }
    }
  }, [upstreams]);

  /** Auto-load models when an endpoint_ref is selected in the combobox */
  const handleEndpointRefChange = useCallback(
    async (index: number, endpointRef: string) => {
      if (!endpointRef) return;
      await connectivity.test(index, {
        type: "endpoint_ref",
        endpoint_ref: endpointRef,
        workspace: currentWorkspace,
      });
    },
    [connectivity, currentWorkspace],
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
    if (v.spec) {
      if (v.spec.model_routes !== undefined) {
        const seenModels = new Set<string>();
        const invalid = v.spec.model_routes.find((route) => {
          if (!route.model.trim() || seenModels.has(route.model.trim())) {
            return true;
          }
          seenModels.add(route.model.trim());
          if (!route.targets.length) return true;
          if (
            route.targets.some(
              (target) =>
                !target.upstream.trim() || !target.upstream_model.trim(),
            )
          ) {
            return true;
          }
          return (
            route.targets.length > 1 &&
            route.targets.every((target) => (target.priority ?? 0) === 0) &&
            route.targets.reduce(
              (sum, target) => sum + (target.weight ?? 0),
              0,
            ) !== 100
          );
        });
        if (invalid) {
          form.setError("spec.model_routes", {
            type: "validate",
            message: invalid.model.trim()
              ? invalid.targets.length > 1 &&
                invalid.targets.every((target) => (target.priority ?? 0) === 0)
                ? t("external_endpoints.validation.weightTotal")
                : t("external_endpoints.validation.routeTargetRequired")
              : t("external_endpoints.validation.virtualModelRequired"),
          });
          return;
        }
      }
      const providerNames = (v.spec.upstreams ?? []).map(
        (upstream, index) => upstream.name || `provider-${index + 1}`,
      );
      v.spec.upstreams = (v.spec.upstreams ?? []).map((upstream, index) => ({
        ...upstream,
        name: providerNames[index],
      }));
      const routes = v.spec.model_routes ?? routesFromLegacy(v.spec.upstreams);
      v.spec.upstreams = v.spec.upstreams.map((upstream) => ({
        ...upstream,
        model_mapping: {},
      }));
      v.spec.model_routes = routes.map((route) => ({
        ...route,
        targets: route.targets.map((target) => ({
          ...target,
          priority: target.priority ?? 0,
          weight: target.weight || 1,
        })),
      }));
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
        <FormCardGrid title={t("external_endpoints.sections.virtualModels")}>
          <FormFieldGroup
            {...form}
            name="spec.model_routes"
            className="col-span-4"
          >
            <ModelRouteEditor
              value={effectiveModelRoutes as ModelRoute[]}
              upstreams={upstreams ?? []}
            />
          </FormFieldGroup>
        </FormCardGrid>
        <FormCardGrid title={t("external_endpoints.sections.modelServices")}>
          <div className="col-span-4 grid grid-cols-[repeat(auto-fit,minmax(420px,1fr))] gap-4 xs:grid-cols-1">
            {fields.map((field, index) => {
              const currentType = deriveUpstreamType(upstreams?.[index]);
              return (
                <Card key={field.id} className="border-border/60 shadow-none">
                  <CardHeader className="flex flex-row items-center justify-between py-2 px-4">
                    <CardTitle>
                      {t("external_endpoints.sections.modelService", {
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
                  <CardContent className="space-y-4 py-4 px-4">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-4 xs:grid-cols-1">
                      <FormFieldGroup
                        {...form}
                        label={t("external_endpoints.fields.provider")}
                        {...form.register(`spec.upstreams.${index}.name`)}
                      >
                        <Input
                          onChange={(event) => {
                            form.setValue(
                              `spec.upstreams.${index}.name`,
                              event.target.value,
                              {
                                shouldDirty: true,
                                shouldValidate: true,
                              },
                            );
                          }}
                          onBlur={(event) => {
                            const currentUpstreams =
                              form.getValues("spec.upstreams") ?? [];
                            const previousName =
                              providerNameSnapshot.current[index] ||
                              `provider-${index + 1}`;
                            const nextName =
                              event.target.value.trim() ||
                              `provider-${index + 1}`;
                            if (previousName !== nextName) {
                              const currentRoutes =
                                form.getValues("spec.model_routes");
                              const routes: ModelRoute[] =
                                currentRoutes ??
                                routesFromLegacy(currentUpstreams);
                              form.setValue(
                                "spec.model_routes",
                                routes.map((route) => ({
                                  ...route,
                                  targets: route.targets.map((target) =>
                                    target.upstream === previousName
                                      ? { ...target, upstream: nextName }
                                      : target,
                                  ),
                                })),
                                { shouldDirty: true },
                              );
                              providerNameSnapshot.current[index] = nextName;
                            }
                          }}
                          placeholder={t(
                            "external_endpoints.placeholders.provider",
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
                            handleUpstreamTypeChange(
                              index,
                              value as UpstreamType,
                            )
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
                            {...form.register(
                              `spec.upstreams.${index}.auth.type`,
                            )}
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
                          <div className="col-span-2 flex items-center xs:col-span-1">
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
                                    )?.spec?.upstreams?.[index]?.upstream
                                      ?.url ?? "")
                                  : "";
                                await connectivity.test(index, {
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
                          <div className="col-span-2 flex items-center xs:col-span-1">
                            <TestConnectivityButton
                              testing={connectivity.testingMap[index] ?? false}
                              result={connectivity.resultMap[index] ?? null}
                              onTest={async () => {
                                const endpointRef =
                                  form.getValues(
                                    `spec.upstreams.${index}.endpoint_ref`,
                                  ) ?? "";
                                await connectivity.test(index, {
                                  type: "endpoint_ref",
                                  endpoint_ref: endpointRef,
                                  workspace: currentWorkspace,
                                });
                              }}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            <Button
              type="button"
              variant="outline"
              onClick={() => append({ ...emptyExternalUpstream })}
              className="min-h-24 w-full border-dashed"
            >
              <Plus className="mr-1 h-4 w-4" />
              {t("external_endpoints.actions.addModelService")}
            </Button>
          </div>
        </FormCardGrid>
      </>
    ),
  };
};
