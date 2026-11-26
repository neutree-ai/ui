import { useList, useSelect } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
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
import {
  migrateLegacyRoutes,
  modelSourceUsage,
  removeRouteUpstream,
  routeForForm,
  routesForSubmit,
  routeTargetsError,
  setModelSource,
  setRouteTargetUpstream,
} from "@/domains/external-endpoint/lib/external-endpoint-form-routes";
import {
  blankExternalUpstream,
  endpointRefOptions,
  hasInvalidUpstreamNames,
  nameUnnamedUpstreams,
  newUpstreamName,
  routeUpstreamLabel,
  takenUpstreamNames,
  upstreamName,
  upstreamReference,
} from "@/domains/external-endpoint/lib/external-endpoint-form-upstreams";
import type { EditableModelRoute } from "@/domains/external-endpoint/lib/route-strategy";
import { routesFromLegacy } from "@/domains/external-endpoint/lib/routes-from-legacy";
import { getRouteStrategyError } from "@/domains/external-endpoint/lib/validate-route-strategy";
import type {
  ExternalEndpoint,
  ExternalEndpointSpec,
  ModelRoute,
  UpstreamSpec,
} from "@/domains/external-endpoint/types";
import {
  isValidWorkspace,
  useWorkspace,
} from "@/foundation/hooks/use-workspace";
import { useTranslation } from "@/foundation/lib/i18n";
import { cn } from "@/foundation/lib/utils";
import { useModelSourceLabel } from "@/foundation/model-reference/ModelSourceBadge";
import {
  deriveRouteModelSource,
  modelSourceSuggestions,
} from "@/foundation/model-reference/model-source";
import { FormSelect } from "@/foundation/role/FormSelect";
import WorkspaceField from "@/foundation/role/WorkspaceField";
import { Disclosure } from "@/foundation/scene/Disclosure";
import FormCardGrid, { FORM_GRID_CLASS } from "@/foundation/scene/FormCardGrid";
import { FormFieldGroup } from "@/foundation/scene/FormFieldGroup";
import { useRefineFieldArray } from "@/foundation/scene/use-refine-field-array";
import UpstreamNameLabel from "../components/UpstreamNameLabel";
import { getUpstreamModelRequest } from "../lib/get-upstream-model-request";

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
        timeout: 300000,
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
        select: (response) => {
          const record = response.data as ExternalEndpoint;
          return {
            ...response,
            data: {
              ...record,
              spec: {
                ...record.spec,
                model_routes: record.spec.model_routes?.map(routeForForm),
              },
            },
          };
        },
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
  const channelReferences = useRef(
    new Map<string, { name: string; url: string }>(),
  );
  const fields = upstreamFields.map((field) => {
    const initial = field as unknown as UpstreamSpec;
    const reference =
      channelReferences.current.get(field.id) ?? upstreamReference(initial);
    channelReferences.current.set(field.id, reference);
    return { ...field, name: reference.name, storedUrl: reference.url };
  });
  const storedNames = fields.map((field) => field.name);
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
  const modelSources = form.watch("spec.model_sources");
  const handleModelSourceChange = useCallback(
    (model: string, value: string) => setModelSource(form, model, value),
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

  const modelSourceLabel = useModelSourceLabel();
  const modelSourceOptions = modelSourceSuggestions(
    modelSourceUsage(
      modelSources,
      effectiveModelRoutes,
      (siblingEndpoints?.data ?? []).map(
        (item) => (item as { spec?: ExternalEndpointSpec | null }).spec ?? null,
      ),
    ),
  ).map((source) => ({
    label: modelSourceLabel(source),
    value: source,
  }));
  const [quickCreateTarget, setQuickCreateTarget] = useState<{
    routeIndex: number;
    targetIndex: number;
  } | null>(null);

  const handleQuickUpstreamCreate = useCallback(
    (name: string, upstream: UpstreamSpec) => {
      if (!quickCreateTarget) return;
      append({ ...upstream, name });
      setRouteTargetUpstream(form, quickCreateTarget, name);
      setQuickCreateTarget(null);
    },
    [append, form, quickCreateTarget],
  );

  // Initialize legacy data in the form itself, so every operation sees the
  // same routes. Missing names are assigned once, never derived after deletion.
  useEffect(() => {
    if (!upstreams?.length) return;
    const named = nameUnnamedUpstreams(
      upstreams,
      fields.map((field) => field.name),
    );
    if (named.some((upstream, index) => upstream !== upstreams[index]))
      replace(named);
    migrateLegacyRoutes(form, modelRoutes, named);
  }, [upstreams, fields, modelRoutes, replace, form]);

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

  const endpointOptions = endpointRefOptions(
    (endpoints.query.data?.data ?? []) as Parameters<
      typeof endpointRefOptions
    >[0],
  );

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
      const providerNames = (v.spec.upstreams ?? []).map(upstreamName);
      if (hasInvalidUpstreamNames(providerNames)) {
        form.setError("spec.model_routes", {
          type: "validate",
          message: t("external_endpoints.validation.duplicateProvider"),
        });
        return;
      }
      if (v.spec.model_routes != null) {
        // Inline feedback and disabled buttons use the same rules; also guard direct submissions.
        if (v.spec.model_routes.some(getRouteStrategyError)) return;

        const routeError = routeTargetsError(v.spec.model_routes, storedNames);
        if (routeError) {
          form.setError("spec.model_routes", {
            type: "validate",
            message: t(routeError),
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
      v.spec.model_routes = routesForSubmit(
        routes as EditableModelRoute[],
        storedNames,
        providerNames,
      );
    }
    return originalOnFinish(v);
  };

  return {
    form,
    submitBlocked: effectiveModelRoutes.some(getRouteStrategyError),
    metadataFields: (
      <FormCardGrid
        title={t("common.sections.basicInformation")}
        className="border-0 shadow-sm [&>div:first-child>h2]:text-lg [&_label]:text-xs [&_label]:text-muted-foreground"
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
          className="border-0 shadow-sm [&>div:first-child>h2]:text-lg [&_label]:text-xs [&_label]:text-muted-foreground"
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
          className="border-0 shadow-sm [&>div:first-child>h2]:text-lg [&_label]:text-xs [&_label]:text-muted-foreground"
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
              impliedModelSource={(route) =>
                deriveRouteModelSource(upstreams, route)
              }
              value={effectiveModelRoutes as ModelRoute[]}
              // Stable reference values, current editable display names.
              providers={fields.map((field, index) => ({
                value: field.name,
                label: routeUpstreamLabel(upstreams?.[index], field.name),
                modelListRequest: getUpstreamModelRequest(
                  upstreams?.[index],
                  currentWorkspace,
                  isEdit
                    ? {
                        name: form.getValues("metadata.name") ?? "",
                        url: field.storedUrl,
                      }
                    : undefined,
                ),
              }))}
              onQuickCreate={(routeIndex, targetIndex) =>
                setQuickCreateTarget({ routeIndex, targetIndex })
              }
            />
          </FormFieldGroup>
        </FormCardGrid>
        <FormCardGrid className="border-0 shadow-sm [&_label]:text-xs [&_label]:text-muted-foreground">
          <div className="col-span-4 flex items-center justify-between border-b border-border/40 pb-3">
            <h2 className="text-lg font-semibold text-foreground">
              {t("external_endpoints.sections.modelServices")}
            </h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                append({
                  ...blankExternalUpstream(),
                  name: newUpstreamName(storedNames, upstreams),
                });
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
                <Disclosure
                  key={field.id}
                  defaultOpen
                  variant="plain"
                  className="rounded-md bg-muted/35 px-4 py-3"
                  leading={
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                      {index + 1}
                    </span>
                  }
                  title={
                    upstreamName(upstreams?.[index]) ||
                    t("external_endpoints.sections.modelService", {
                      index: index + 1,
                    })
                  }
                  summary={
                    currentType === "endpoint_ref"
                      ? t("external_endpoints.options.upstreamTypeEndpointRef")
                      : t("external_endpoints.options.upstreamTypeExternal")
                  }
                  actions={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        form.setValue(
                          "spec.model_routes",
                          removeRouteUpstream(
                            form.getValues("spec.model_routes"),
                            field.name,
                          ),
                          { shouldDirty: true },
                        );
                        remove(index);
                      }}
                      aria-label={t(
                        "external_endpoints.actions.removeUpstream",
                      )}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  }
                  contentClassName="pt-4"
                >
                  <div className={cn(FORM_GRID_CLASS, "items-start")}>
                    <FormField
                      control={form.control}
                      name={`spec.upstreams.${index}.name`}
                      render={({ field }) => (
                        <FormItem
                          data-testid={`field-spec.upstreams.${index}.name`}
                        >
                          <UpstreamNameLabel />
                          <div className="space-y-1">
                            <FormControl>
                              <Input
                                {...field}
                                placeholder={t(
                                  "external_endpoints.placeholders.provider",
                                )}
                              />
                            </FormControl>
                            <FormMessage />
                          </div>
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
                          {...form.register(
                            `spec.upstreams.${index}.auth.type`,
                          )}
                        />
                        <FormFieldGroup
                          {...form}
                          name={`spec.upstreams.${index}.auth.credential`}
                          label={t("external_endpoints.fields.credential")}
                          className="sm:col-span-4"
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
                        <div className="mt-3 flex justify-start sm:col-span-4">
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
                                ? field.storedUrl
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
                          className="sm:col-span-4"
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
                        <div className="mt-3 flex justify-start sm:col-span-4">
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
                </Disclosure>
              );
            })}
          </div>
        </FormCardGrid>
        <QuickUpstreamDialog
          open={quickCreateTarget !== null}
          onOpenChange={(open) => {
            if (!open) setQuickCreateTarget(null);
          }}
          existingNames={takenUpstreamNames(storedNames, upstreams)}
          endpointOptions={endpointOptions}
          onCreate={handleQuickUpstreamCreate}
        />
      </>
    ),
  };
};
