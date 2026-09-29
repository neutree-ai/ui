import { Plus, Trash2 } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/button";
import { FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { FormCombobox } from "@/foundation/components/FormCombobox";
import { FormSelect } from "@/foundation/components/FormSelect";
import { useTranslation } from "@/foundation/lib/i18n";
import {
  INTERNAL_SHARED_MODEL_SOURCE,
  type ModelSourceMap,
  modelSourceTranslationKey,
} from "@/foundation/lib/model-source";
import type { getUpstreamModelRequest } from "../lib/get-upstream-model-request";
import { getRouteStrategyError } from "../lib/validate-route-strategy";
import type { ModelRoute, ModelRouteTarget } from "../types";
import UpstreamModelInput, {
  UpstreamConnectionWarning,
} from "./UpstreamModelInput";

type Mode = "fixed" | "priority" | "weighted";

type Props = {
  value?: ModelRoute[];
  onChange?: (value: ModelRoute[]) => void;
  providers: {
    label: string;
    value: string;
    modelListRequest?: ReturnType<typeof getUpstreamModelRequest>;
  }[];
  onQuickCreate?: (routeIndex: number, targetIndex: number) => void;
  focusModel?: string;
  /**
   * Each model's source, keyed by the route's `model`. Edited here because this
   * is where the admin names the model; a separate list keyed by the same names
   * would be two places to keep in step.
   */
  modelSources?: ModelSourceMap;
  onModelSourceChange?: (model: string, source: string) => void;
  modelSourceOptions?: { label: string; value: string }[];
  /**
   * Provider names whose upstream points at an internal endpoint. A route whose
   * targets all resolve there is internal by construction, so its source is
   * derived and the admin does not have to choose one. "All", not "any": a model
   * that also falls back to a third party is not purely internal.
   */
  internalProviders?: Set<string>;
};

export default function ModelRouteEditor({
  value = [],
  onChange,
  providers,
  onQuickCreate,
  focusModel,
  modelSources,
  onModelSourceChange,
  modelSourceOptions,
  internalProviders,
}: Props) {
  const { t } = useTranslation();
  const editorId = useId();
  const routeIds = useRef<string[]>([]);
  const nextRouteId = useRef(0);
  const editor = useRef<HTMLDivElement>(null);
  const focusedModel = useRef<string>();
  const focusIndex = value.findIndex((route) => route.model === focusModel);

  const ensureRouteIds = (length: number) => {
    while (routeIds.current.length < length) {
      routeIds.current.push(`route-${nextRouteId.current++}`);
    }
    routeIds.current = routeIds.current.slice(0, length);
  };

  useEffect(() => {
    if (!focusModel || focusedModel.current === focusModel || focusIndex < 0)
      return;
    const card = editor.current?.children.item(focusIndex);
    card?.scrollIntoView({ block: "center" });
    card?.querySelector("input")?.focus({ preventScroll: true });
    focusedModel.current = focusModel;
  }, [focusModel, focusIndex]);

  ensureRouteIds(value.length);

  const commit = (next: ModelRoute[]) => onChange?.(next);

  const updateRoute = (index: number, route: ModelRoute) =>
    commit(value.map((item, i) => (i === index ? route : item)));

  const setMode = (index: number, mode: Mode) => {
    const route = value[index];
    if (!route) return;

    let targets = route.targets.length
      ? route.targets
      : [{ upstream: providers[0]?.value || "", upstream_model: "" }];
    if (mode === "fixed") {
      targets = targets.slice(0, 1);
    }
    if (mode !== "fixed" && targets.length === 1) {
      targets = [
        targets[0],
        mode === "weighted"
          ? { upstream: "", upstream_model: "" }
          : { upstream: "", upstream_model: "", priority: 1 },
      ];
    }

    const normalized = targets.map((target, targetIndex) => ({
      ...target,
      priority: mode === "priority" ? targetIndex : 0,
      weight: mode === "weighted" ? target.weight : undefined,
      max_inflight_requests:
        mode === "weighted" ? undefined : target.max_inflight_requests,
    }));
    commit(
      value.map((item, itemIndex) =>
        itemIndex === index
          ? { ...route, strategy: mode, targets: normalized }
          : item,
      ),
    );
  };

  const updateTarget = (
    routeIndex: number,
    targetIndex: number,
    target: ModelRouteTarget,
  ) => {
    const route = value[routeIndex];
    if (!route) return;
    const targets = route.targets.slice();
    targets[targetIndex] = target;
    updateRoute(routeIndex, { ...route, targets });
  };

  return (
    <div ref={editor} className="space-y-4">
      {value.map((route, index) => {
        const key = routeIds.current[index];
        const mode = route.strategy ?? "fixed";
        const hasActions = mode !== "fixed";
        const weightTotal = route.targets.reduce(
          (sum, target) => sum + (target.weight ?? 0),
          0,
        );
        const strategyError = getRouteStrategyError(route);
        const weightTotalId = `${editorId}-${key}-weight-total`;
        const modelInputId = `${editorId}-${key}-model`;
        const targets = route.targets ?? [];
        const routeIsInternal =
          targets.length > 0 &&
          targets.every((target) =>
            internalProviders?.has(String(target.upstream ?? "")),
          );
        const primaryTargetIndices = route.targets.flatMap(
          (target, targetIndex) =>
            (target.priority ?? 0) === 0 ? [targetIndex] : [],
        );
        const fallbackTargetIndices = route.targets.flatMap(
          (target, targetIndex) =>
            (target.priority ?? 0) > 0 ? [targetIndex] : [],
        );
        const addTarget = (primary = false) => {
          const target: ModelRouteTarget = { upstream: "", upstream_model: "" };
          if (mode === "priority") {
            target.priority = primary
              ? 0
              : Math.max(
                  0,
                  ...route.targets.map((item) => item.priority ?? 0),
                ) + 1;
          }
          commit(
            value.map((item, itemIndex) =>
              itemIndex === index
                ? { ...item, targets: [...item.targets, target] }
                : item,
            ),
          );
        };
        const targetTable = (
          targetIndices: number[],
          label: string,
          requireCapacity = false,
        ) => (
          <div className="overflow-x-auto">
            <table
              aria-label={label}
              className="w-full min-w-[440px] table-fixed text-left text-sm [&_th]:px-2 [&_th]:pb-1 [&_th]:text-xs [&_th]:font-medium [&_th]:text-muted-foreground [&_td]:px-2 [&_td]:py-1.5 [&_tr>:first-child]:pl-0 [&_tr>:last-child]:pr-0"
            >
              <colgroup>
                <col />
                <col />
                <col className={mode === "weighted" ? "w-28" : "w-36"} />
                {hasActions && <col className="w-12" />}
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">{t("external_endpoints.fields.provider")}</th>
                  <th scope="col">
                    {t("external_endpoints.fields.upstreamModelName")}
                  </th>
                  <th
                    scope="col"
                    title={
                      mode === "weighted"
                        ? undefined
                        : t(
                            requireCapacity
                              ? "external_endpoints.messages.primaryCapacityRequired"
                              : "external_endpoints.messages.maxInflightRequestsHint",
                          )
                    }
                  >
                    {mode === "weighted"
                      ? t("external_endpoints.fields.weightRatio")
                      : t("external_endpoints.fields.maxInflightRequests")}
                    {requireCapacity && (
                      <span
                        className="ml-1 text-destructive"
                        aria-hidden="true"
                      >
                        *
                      </span>
                    )}
                  </th>
                  {hasActions && (
                    <th scope="col" className="text-center">
                      {t("table.actions")}
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {targetIndices.map((targetIndex) => {
                  const target = route.targets[targetIndex] ?? {
                    upstream: "",
                    upstream_model: "",
                  };
                  const modelListRequest = providers.find(
                    (provider) => provider.value === target.upstream,
                  )?.modelListRequest;
                  return (
                    <tr key={targetIndex}>
                      <td>
                        <FormItem className="space-y-0 flex items-center gap-2">
                          <FormLabel className="sr-only">
                            {t("external_endpoints.fields.provider")}
                          </FormLabel>
                          <div className="min-w-0 flex-1">
                            <FormSelect
                              value={target.upstream}
                              options={[
                                ...providers,
                                {
                                  label: `+ ${t("external_endpoints.actions.quickCreateUpstream")}`,
                                  value: "__quick_create_upstream__",
                                },
                              ]}
                              placeholder={t(
                                "external_endpoints.placeholders.selectProvider",
                              )}
                              onChange={(next) => {
                                // Radix's native form select can emit an empty value
                                // while newly added options mount. This control cannot clear a target.
                                if (!next) return;
                                if (next === "__quick_create_upstream__") {
                                  onQuickCreate?.(index, targetIndex);
                                  return;
                                }
                                const targets = route.targets.slice();
                                targets[targetIndex] = {
                                  ...target,
                                  upstream: next,
                                };
                                commit(
                                  value.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? { ...item, targets }
                                      : item,
                                  ),
                                );
                              }}
                            />
                          </div>
                          <UpstreamConnectionWarning
                            request={modelListRequest}
                          />
                        </FormItem>
                      </td>
                      <td>
                        <UpstreamModelInput
                          key={target.upstream}
                          value={target.upstream_model}
                          request={modelListRequest}
                          onChange={(model) =>
                            updateTarget(index, targetIndex, {
                              ...target,
                              upstream_model: model,
                            })
                          }
                        />
                      </td>
                      <td>
                        {mode === "weighted" ? (
                          <div className="relative">
                            <Input
                              type="number"
                              aria-invalid={!!strategyError}
                              aria-describedby={weightTotalId}
                              min={1}
                              max={100}
                              step={1}
                              required
                              value={target.weight ?? ""}
                              onChange={(event) =>
                                updateTarget(index, targetIndex, {
                                  ...target,
                                  weight:
                                    event.target.value === ""
                                      ? undefined
                                      : event.target.valueAsNumber,
                                })
                              }
                              aria-label={t(
                                "external_endpoints.fields.weightRatio",
                              )}
                              placeholder={t(
                                "external_endpoints.placeholders.weight",
                              )}
                              className="pr-7"
                            />
                            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                              %
                            </span>
                          </div>
                        ) : (
                          <Input
                            type="number"
                            min={requireCapacity ? 1 : 0}
                            required={requireCapacity}
                            max={2147483647}
                            step={1}
                            value={target.max_inflight_requests ?? ""}
                            placeholder={t(
                              requireCapacity
                                ? "external_endpoints.placeholders.primaryCapacity"
                                : "external_endpoints.fields.unlimited",
                            )}
                            aria-label={t(
                              "external_endpoints.fields.maxInflightRequests",
                            )}
                            title={t(
                              requireCapacity
                                ? "external_endpoints.messages.primaryCapacityRequired"
                                : "external_endpoints.messages.maxInflightRequestsHint",
                            )}
                            onChange={(event) =>
                              updateTarget(index, targetIndex, {
                                ...target,
                                max_inflight_requests:
                                  event.target.value === ""
                                    ? undefined
                                    : event.target.valueAsNumber,
                              })
                            }
                          />
                        )}
                      </td>
                      {hasActions && (
                        <td className="text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            disabled={
                              route.targets.length <= 1 ||
                              (requireCapacity &&
                                primaryTargetIndices.length <= 1)
                            }
                            aria-label={t(
                              "external_endpoints.actions.removeTarget",
                            )}
                            onClick={() =>
                              commit(
                                value.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? {
                                        ...item,
                                        targets: item.targets.filter(
                                          (_, i) => i !== targetIndex,
                                        ),
                                      }
                                    : item,
                                ),
                              )
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
        return (
          <section
            key={key}
            aria-labelledby={`${editorId}-${key}-title`}
            className="rounded-lg border border-border/70 bg-card p-4"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                <h3
                  id={`${editorId}-${key}-title`}
                  className="break-all text-base font-semibold text-foreground"
                >
                  {t("external_endpoints.sections.routeConfiguration", {
                    model:
                      route.model ||
                      t("external_endpoints.messages.unnamedModel"),
                  })}
                </h3>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                aria-label={t("external_endpoints.actions.removeVirtualModel")}
                onClick={() => {
                  routeIds.current.splice(index, 1);
                  commit(value.filter((_, itemIndex) => itemIndex !== index));
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="mb-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label
                  htmlFor={modelInputId}
                  className="text-xs font-medium text-muted-foreground"
                >
                  {t("external_endpoints.fields.virtualModelName")}
                </label>
                <Input
                  id={modelInputId}
                  value={route.model}
                  onChange={(event) =>
                    updateRoute(index, { ...route, model: event.target.value })
                  }
                  placeholder={t(
                    "external_endpoints.placeholders.virtualModel",
                  )}
                />
              </div>
              <FormItem className="space-y-1.5">
                <FormLabel className="text-xs font-medium text-muted-foreground">
                  {t("modelSource.label")}
                </FormLabel>
                <FormCombobox
                  value={route.model ? (modelSources?.[route.model] ?? "") : ""}
                  onChange={(next) =>
                    onModelSourceChange?.(route.model, String(next))
                  }
                  placeholder={
                    routeIsInternal
                      ? t(
                          modelSourceTranslationKey(
                            INTERNAL_SHARED_MODEL_SOURCE,
                          ),
                          { defaultValue: INTERNAL_SHARED_MODEL_SOURCE },
                        )
                      : t("modelSource.placeholder")
                  }
                  options={modelSourceOptions ?? []}
                  disabled={!route.model}
                  allowCustomValue
                  asField={false}
                />
              </FormItem>
              <FormItem className="space-y-1.5">
                <FormLabel className="text-xs font-medium text-muted-foreground">
                  {t("external_endpoints.fields.routingMode")}
                </FormLabel>
                <FormSelect
                  value={mode}
                  onChange={(next) => setMode(index, next as Mode)}
                  options={[
                    {
                      label: t("external_endpoints.options.fixedRouting"),
                      value: "fixed",
                    },
                    {
                      label: t("external_endpoints.options.priorityRouting"),
                      value: "priority",
                    },
                    {
                      label: t("external_endpoints.options.weightedRouting"),
                      value: "weighted",
                    },
                  ]}
                />
                <p
                  className="text-xs leading-5 text-muted-foreground"
                  aria-live="polite"
                >
                  {mode === "fixed"
                    ? t("external_endpoints.messages.fixedRoutingHint")
                    : mode === "priority"
                      ? t("external_endpoints.messages.priorityRoutingHint")
                      : t("external_endpoints.messages.weightedRoutingHint")}
                </p>
              </FormItem>
            </div>
            {mode === "priority" ? (
              <div className="space-y-3">
                <section className="rounded-md bg-[#F7F9FC] p-3 dark:bg-muted/40">
                  <h4 className="mb-2 text-sm font-semibold">
                    {t("external_endpoints.sections.primaryTargets")}
                  </h4>
                  {targetTable(
                    primaryTargetIndices,
                    t("external_endpoints.sections.primaryTargets"),
                    true,
                  )}
                  <p
                    role={strategyError ? "alert" : undefined}
                    className={`mt-1 text-xs ${strategyError ? "text-destructive" : "text-muted-foreground"}`}
                  >
                    {t(
                      strategyError ??
                        "external_endpoints.messages.primaryCapacityRequired",
                    )}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => addTarget(true)}
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    {t("external_endpoints.actions.addPrimaryTarget")}
                  </Button>
                </section>
                <section className="rounded-md bg-[#F7F9FC] p-3 dark:bg-muted/40">
                  <h4 className="mb-2 text-sm font-semibold">
                    {t("external_endpoints.sections.fallbackTargets")}
                  </h4>
                  {targetTable(
                    fallbackTargetIndices,
                    t("external_endpoints.sections.fallbackTargets"),
                  )}
                  {fallbackTargetIndices.length === 0 && (
                    <p className="py-2 text-sm text-muted-foreground">
                      {t("external_endpoints.messages.noFallbackTargets")}
                    </p>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => addTarget(false)}
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    {t("external_endpoints.actions.addFallbackTarget")}
                  </Button>
                </section>
              </div>
            ) : (
              <div className="rounded-md bg-[#F7F9FC] p-3 dark:bg-muted/40">
                {targetTable(
                  mode === "fixed"
                    ? [0]
                    : route.targets.map((_, targetIndex) => targetIndex),
                  route.model,
                )}
                {mode === "weighted" && (
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addTarget(false)}
                    >
                      <Plus className="mr-1 h-4 w-4" />
                      {t("external_endpoints.actions.addWeightedTarget")}
                    </Button>
                    <p
                      id={weightTotalId}
                      role="status"
                      className={
                        !strategyError
                          ? "text-sm text-green-700 dark:text-green-400"
                          : "text-sm text-destructive"
                      }
                    >
                      {t(
                        strategyError ??
                          "external_endpoints.messages.weightTotalValid",
                        { total: weightTotal },
                      )}
                    </p>
                  </div>
                )}
              </div>
            )}
          </section>
        );
      })}
      <Button
        type="button"
        variant="outline"
        onClick={() =>
          commit([
            ...value,
            {
              model: "",
              strategy: "fixed",
              targets: [
                { upstream: providers[0]?.value || "", upstream_model: "" },
              ],
            },
          ])
        }
      >
        <Plus className="mr-1 h-4 w-4" />
        {t("external_endpoints.actions.addVirtualModel")}
      </Button>
    </div>
  );
}
