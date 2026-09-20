import { useList, useSelect } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { EndpointRefSelect } from "@/domains/external-endpoint/components/EndpointRefSelect";
import ModelRouteEditor from "@/domains/external-endpoint/components/ModelRouteEditor";
import QuickUpstreamDialog from "@/domains/external-endpoint/components/QuickUpstreamDialog";
import TestConnectivityButton from "@/domains/external-endpoint/components/TestConnectivityButton";
import TimeoutInput from "@/domains/external-endpoint/components/TimeoutInput";
import { useTestConnectivity } from "@/domains/external-endpoint/hooks/use-test-connectivity";
import { cleanUpstreamsForSubmit } from "@/domains/external-endpoint/lib/clean-upstreams-for-submit";
import type { UpstreamType } from "@/domains/external-endpoint/lib/derive-upstream-type";
import { deriveUpstreamType } from "@/domains/external-endpoint/lib/derive-upstream-type";
import { getRouteStrategyError } from "@/domains/external-endpoint/lib/validate-route-strategy";
import type {
  ExternalEndpoint,
  ModelRoute,
  UpstreamSpec,
} from "@/domains/external-endpoint/types";
import FormCardGrid from "@/foundation/components/FormCardGrid";
import { FormFieldGroup } from "@/foundation/components/FormFieldGroup";
import { FormSelect } from "@/foundation/components/FormSelect";
import WorkspaceField from "@/foundation/components/WorkspaceField";
import { useRefineFieldArray } from "@/foundation/hooks/use-refine-field-array";
import {
  isValidWorkspace,
  useWorkspace,
} from "@/foundation/hooks/use-workspace";
import { useTranslation } from "@/foundation/lib/i18n";
import {
  externalModelSourceSuggestions,
  modelSourceTranslationKey,
} from "@/foundation/lib/model-source";
import UpstreamNameLabel from "../components/UpstreamNameLabel";

const emptyExternalUpstream: UpstreamSpec = {
  upstream: { url: "" },
  auth: { type: "bearer", credential: "" },
  model_mapping: {},
  models: null,
};

function nextProviderName(usedNames: Set<string | undefined>) {
  let index = 1;
  while (usedNames.has(`provider-${index}`)) index++;
  return `provider-${index}`;
}

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
        strategy: "fixed",
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

function removeRouteProvider(
  routes: ModelRoute[] | null | undefined,
  providerName: string,
): ModelRoute[] | null | undefined {
  if (!routes) return routes;
  return routes
    .map((route) => ({
      ...route,
      targets: route.targets.filter(
        (target) => target.upstream !== providerName,
      ),
    }))
    .filter((route) => route.targets.length > 0);
}

export const useExternalEndpointForm = ({
  action,
  focusModel,
}: {
  action: "create" | "edit";
  focusModel?: string;
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
        upstreams: [],
        model_routes:
          action === "create"
            ? [
                {
                  model: "",
                  strategy: "fixed",
                  targets: [{ upstream: "", upstream_model: "" }],
                },
              ]
            : undefined,
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

  const {
    fields: upstreamFields,
    append,
    remove,
    replace,
  } = useRefineFieldArray({
    control: form.control,
    name: "spec.upstreams",
    refineForm: form,
  });

  // Field-array operations rebuild values from the edited form. Retain each
  // row's original reference by its stable RHF id until submission.
  const channelNames = useRef(new Map<string, string>());
  const fields = upstreamFields.map((field) => {
    const name =
      channelNames.current.get(field.id) ??
      (field as { name?: string }).name ??
      "";
    channelNames.current.set(field.id, name);
    return { ...field, name };
  });
  const isEdit = action === "edit";

  const connectivity = useTestConnectivity();

  // Derive upstream types from form data — no separate state needed
  const upstreams: UpstreamSpec[] = form.watch("spec.upstreams");
  const modelRoutes = form.watch("spec.model_routes");
  const effectiveModelRoutes: ModelRoute[] = modelRoutes ?? [];

  // Model sources. Stored per MODEL on spec.model_sources, keyed by the route's
  // model name: one endpoint fronts models of different origin, and a model can
  // have targets across several upstreams, so neither the endpoint nor an
  // upstream resolves to a single source.
  //
  // `self-hosted` is deliberately absent from the options: it is the derived
  // source of internal endpoints, the backend rejects it here, and offering it
  // would make two rows for the same model name indistinguishable in the
  // API-key model picker.
  const modelSources = form.watch("spec.model_sources");
  const handleModelSourceChange = useCallback(
    (model: string, value: string) => {
      if (!model) return;

      const next = { ...(form.getValues("spec.model_sources") ?? {}) };
      if (value) next[model] = value;
      else delete next[model];
      form.setValue("spec.model_sources", next, { shouldDirty: true });
    },
    [form],
  );

  // Every external endpoint in the workspace, read only for the source values
  // already in use — the presets are a starting point, not the whole set.
  const { data: siblingEndpoints } = useList({
    resource: "external_endpoints",
    pagination: { mode: "off" },
    meta: { workspace: currentWorkspace, workspaced: true },
    queryOptions: { enabled: isValidWorkspace(currentWorkspace) },
  });

  const modelSourceOptions = externalModelSourceSuggestions(
    (siblingEndpoints?.data ?? []).map(
      (item) =>
        (item as { spec?: { model_sources?: Record<string, string> | null } })
          .spec?.model_sources,
    ),
  ).map((source) => ({
    label: t(modelSourceTranslationKey(source), { defaultValue: source }),
    value: source,
  }));

  // Providers backed by an internal endpoint: a route whose targets all land
  // there is internal by construction.
  const internalProviders = new Set(
    (upstreams ?? [])
      .filter((upstream) => String(upstream?.endpoint_ref ?? "").trim())
      .map((upstream) => String(upstream?.name ?? "")),
  );
  const [quickCreateTarget, setQuickCreateTarget] = useState<{
    routeIndex: number;
    targetIndex: number;
  } | null>(null);
  const [expandedUpstreams, setExpandedUpstreams] = useState<
    Record<number, boolean>
  >({});

  const handleQuickUpstreamCreate = useCallback(
    (name: string, upstream: UpstreamSpec) => {
      if (!quickCreateTarget) return;
      append({ ...upstream, name });
      const routes: ModelRoute[] = form.getValues("spec.model_routes") ?? [];
      const { routeIndex, targetIndex } = quickCreateTarget;
      form.setValue(
        "spec.model_routes",
        routes.map((route, index) =>
          index === routeIndex
            ? {
                ...route,
                targets: route.targets.map((target, index) =>
                  index === targetIndex
                    ? { ...target, upstream: name }
                    : target,
                ),
              }
            : route,
        ),
        { shouldDirty: true, shouldValidate: true },
      );
      setQuickCreateTarget(null);
    },
    [append, form, quickCreateTarget],
  );

  // Initialize legacy data in the form itself, so every operation sees the
  // same routes. Missing names are assigned once, never derived after deletion.
  useEffect(() => {
    if (!upstreams?.length) return;
    const usedNames = new Set(
      upstreams.map((upstream) => upstream.name).filter(Boolean),
    );
    const named = upstreams.map((upstream, index) => {
      if (fields[index]?.name || upstream.name) return upstream;
      const name = nextProviderName(usedNames);
      usedNames.add(name);
      return { ...upstream, name };
    });
    if (named.some((upstream, index) => upstream !== upstreams[index]))
      replace(named);
    if (modelRoutes == null) {
      form.setValue("spec.model_routes", routesFromLegacy(named));
    }
  }, [upstreams, fields, modelRoutes, replace, form.setValue]);

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
    const v = { ...values, spec: { ...values.spec } } as ExternalEndpoint;
    if (v.spec?.upstreams) {
      v.spec.upstreams = cleanUpstreamsForSubmit(
        v.spec.upstreams,
        isEdit,
        form.formState.touchedFields.spec?.upstreams,
      );
    }
    if (v.spec) {
      const providerNames = (v.spec.upstreams ?? []).map(
        (upstream) => upstream.name?.trim() || "",
      );
      if (
        providerNames.some((name) => !name) ||
        new Set(providerNames).size !== providerNames.length
      ) {
        form.setError("spec.model_routes", {
          type: "validate",
          message: t("external_endpoints.validation.duplicateProvider"),
        });
        return;
      }
      if (v.spec.model_routes != null) {
        // Inline feedback and disabled buttons use the same rules; also guard direct submissions.
        if (v.spec.model_routes.some(getRouteStrategyError)) return;

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
                !target.upstream.trim() ||
                !target.upstream_model.trim() ||
                !fields.some((field) => field.name === target.upstream),
            )
          ) {
            return true;
          }
          return false;
        });
        if (invalid) {
          form.setError("spec.model_routes", {
            type: "validate",
            message: invalid.model.trim()
              ? t("external_endpoints.validation.routeTargetRequired")
              : t("external_endpoints.validation.virtualModelRequired"),
          });
          return;
        }
      }
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
        strategy: route.strategy ?? "fixed",
        targets: route.targets.map((target) => ({
          ...target,
          upstream:
            providerNames[
              fields.findIndex((field) => field.name === target.upstream)
            ] ?? target.upstream,
          priority: target.priority ?? 0,
          weight:
            route.strategy === "weighted" ? target.weight : target.weight || 1,
        })),
      }));
    }
    return originalOnFinish(v);
  };

  return {
    form,
    submitBlocked: effectiveModelRoutes.some(getRouteStrategyError),
    metadataFields: (
      <FormCardGrid
        title={t("common.sections.basicInformation")}
        className="border-0 shadow-sm [&>div:first-child>h2]:text-lg [&_label]:text-xs [&_label]:text-muted-foreground [&_input]:border-border/50 [&_input]:shadow-none"
      >
        <FormFieldGroup
          {...form}
          className="max-w-md"
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
          className="max-w-md"
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
        <FormCardGrid
          title={t("external_endpoints.sections.configuration")}
          className="border-0 shadow-sm [&>div:first-child>h2]:text-lg [&_label]:text-xs [&_label]:text-muted-foreground [&_input]:border-border/50 [&_input]:shadow-none"
        >
          <FormFieldGroup
            {...form}
            name="spec.timeout"
            className="max-w-xs"
            label={t("external_endpoints.fields.timeout")}
          >
            <TimeoutInput />
          </FormFieldGroup>
        </FormCardGrid>
        <FormCardGrid
          title={t("external_endpoints.sections.virtualModels")}
          className="border-0 shadow-sm [&>div:first-child>h2]:text-lg [&_label]:text-xs [&_label]:text-muted-foreground [&_input]:border-border/50 [&_input]:shadow-none"
        >
          <FormFieldGroup
            {...form}
            name="spec.model_routes"
            className="col-span-4"
          >
            <ModelRouteEditor
              focusModel={focusModel}
              modelSources={modelSources}
              onModelSourceChange={handleModelSourceChange}
              modelSourceOptions={modelSourceOptions}
              internalProviders={internalProviders}
              value={effectiveModelRoutes as ModelRoute[]}
              // Stable reference values, current editable display names.
              providers={fields.map((field, index) => ({
                value: field.name || "",
                label: upstreams?.[index]?.name || field.name || "",
              }))}
              onQuickCreate={(routeIndex, targetIndex) =>
                setQuickCreateTarget({ routeIndex, targetIndex })
              }
            />
          </FormFieldGroup>
        </FormCardGrid>
        <FormCardGrid className="border-0 shadow-sm [&_label]:text-xs [&_label]:text-muted-foreground [&_input]:border-border/50 [&_input]:shadow-none">
          <div className="col-span-4 flex items-center justify-between border-b border-border/40 pb-3">
            <h2 className="text-lg font-semibold text-foreground">
              {t("external_endpoints.sections.modelServices")}
            </h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const nextIndex = fields.length;
                append({
                  ...emptyExternalUpstream,
                  name: nextProviderName(
                    new Set([
                      ...fields.map((field) => field.name),
                      ...(upstreams ?? []).map((upstream) => upstream.name),
                    ]),
                  ),
                });
                setExpandedUpstreams((current) => ({
                  ...current,
                  [nextIndex]: true,
                }));
              }}
            >
              <Plus className="mr-1 h-4 w-4" />
              {t("external_endpoints.actions.addModelService")}
            </Button>
          </div>
          <div className="col-span-4 space-y-3">
            {fields.map((field, index) => {
              const currentType = deriveUpstreamType(upstreams?.[index]);
              return (
                <Collapsible
                  key={field.id}
                  open={isEdit || (expandedUpstreams[index] ?? false)}
                  onOpenChange={(open) =>
                    setExpandedUpstreams((current) => ({
                      ...current,
                      [index]: open,
                    }))
                  }
                  className="rounded-md bg-muted/35 px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                          {index + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-foreground">
                            {upstreams?.[index]?.name?.trim() ||
                              t("external_endpoints.sections.modelService", {
                                index: index + 1,
                              })}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {currentType === "endpoint_ref"
                              ? t(
                                  "external_endpoints.options.upstreamTypeEndpointRef",
                                )
                              : t(
                                  "external_endpoints.options.upstreamTypeExternal",
                                )}
                          </span>
                        </span>
                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform data-[state=open]:rotate-180" />
                      </button>
                    </CollapsibleTrigger>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        form.setValue(
                          "spec.model_routes",
                          removeRouteProvider(
                            form.getValues("spec.model_routes"),
                            field.name || "",
                          ),
                          { shouldDirty: true },
                        );
                        remove(index);
                      }}
                      disabled={fields.length <= 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <CollapsibleContent className="pt-4">
                    <div className="grid grid-cols-4 items-start gap-x-4 gap-y-4 xs:grid-cols-1">
                      <FormField
                        control={form.control}
                        name={`spec.upstreams.${index}.name`}
                        render={({ field }) => (
                          <FormItem
                            data-testid={`field-spec.upstreams.${index}.name`}
                          >
                            <UpstreamNameLabel />
                            <FormControl>
                              <Input
                                {...field}
                                placeholder={t(
                                  "external_endpoints.placeholders.provider",
                                )}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
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
                            className="col-span-4 xs:col-span-1"
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
                          <div className="col-span-4 mt-3 flex justify-start">
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
                            className="col-span-4 xs:col-span-1"
                          >
                            <EndpointRefSelect
                              options={endpointOptions}
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
                          <div className="col-span-4 mt-3 flex justify-start">
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
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        </FormCardGrid>
        <QuickUpstreamDialog
          open={quickCreateTarget !== null}
          onOpenChange={(open) => {
            if (!open) setQuickCreateTarget(null);
          }}
          existingNames={[
            ...fields.map((field) => field.name || ""),
            ...(upstreams ?? []).map((upstream) => upstream.name?.trim() || ""),
          ]}
          endpointOptions={endpointOptions}
          onCreate={handleQuickUpstreamCreate}
        />
      </>
    ),
  };
};
