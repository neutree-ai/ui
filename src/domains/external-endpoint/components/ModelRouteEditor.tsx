import { CircleHelp, Plus, Trash2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslation } from "@/foundation/lib/i18n";
import { useModelSourceLabel } from "@/foundation/model-reference/ModelSourceBadge";
import type {
  ModelSource,
  ModelSourceMap,
} from "@/foundation/model-reference/model-source";
import { FormCombobox } from "@/foundation/role/FormCombobox";
import { FormSelect } from "@/foundation/role/FormSelect";
import { ConfirmDialog } from "@/foundation/scene/ConfirmDialog";
import type { getUpstreamModelRequest } from "../lib/get-upstream-model-request";
import {
  canChooseModelSource,
  newRouteTarget,
  priorityTargetIndices,
  ROUTE_STRATEGY_TEXT,
  routeCardModel,
  routeIndexOfModel,
  routeModelSource,
  routeStrategyOf,
  routeWeightTotal,
  targetNumberValue,
  targetProvider,
  withTargetNumber,
} from "../lib/model-route-view";
import {
  changeRouteStrategy,
  type EditableModelRoute,
  type RouteStrategy,
} from "../lib/route-strategy";
import { getRouteStrategyError } from "../lib/validate-route-strategy";
import type { ModelRoute, ModelRouteTarget } from "../types";
import UpstreamModelInput, {
  UpstreamConnectionWarning,
} from "./UpstreamModelInput";

type Mode = RouteStrategy;

type Props = {
  value?: EditableModelRoute[];
  onChange?: (value: EditableModelRoute[]) => void;
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
   * The source a route's targets imply while none is chosen for its model.
   * Shown as the placeholder, so the admin sees what applies without choosing.
   */
  impliedModelSource?: (route: ModelRoute) => ModelSource | undefined;
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
  impliedModelSource,
}: Props) {
  const { t } = useTranslation();
  const modelSourceLabel = useModelSourceLabel();
  const editorId = useId();
  const [pendingStrategy, setPendingStrategy] = useState<{
    index: number;
    route: EditableModelRoute;
  } | null>(null);
  const routeIds = useRef<string[]>([]);
  const nextRouteId = useRef(0);
  const editor = useRef<HTMLDivElement>(null);
  const focusedModel = useRef<string>();
  const focusIndex = routeIndexOfModel(value, focusModel);

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
    const current = value[index];
    if (!current) return;
    const next = changeRouteStrategy(current, mode, providers[0]?.value || "");
    if (next.route === current) return;
    if (next.losesConfiguration) {
      setPendingStrategy({ index, route: next.route });
      return;
    }
    updateRoute(index, next.route);
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
      <ConfirmDialog
        open={pendingStrategy !== null}
        onOpenChange={(open) => {
          if (!open) setPendingStrategy(null);
        }}
        title={t("external_endpoints.messages.changeStrategyTitle")}
        description={t("external_endpoints.messages.changeStrategyDescription")}
        okText={t("external_endpoints.actions.changeStrategy")}
        cancelText={t("buttons.cancel")}
        onConfirm={() => {
          if (pendingStrategy)
            updateRoute(pendingStrategy.index, pendingStrategy.route);
          setPendingStrategy(null);
        }}
      />
      {value.map((route, index) => {
        const key = routeIds.current[index];
        const mode = routeStrategyOf(route);
        const hasActions = mode !== "fixed";
        const weightTotal = routeWeightTotal(route);
        const strategyError = getRouteStrategyError(route);
        const weightTotalId = `${editorId}-${key}-weight-total`;
        const modelInputId = `${editorId}-${key}-model`;
        const impliedSource = impliedModelSource?.(route);
        const {
          primary: primaryTargetIndices,
          fallback: fallbackTargetIndices,
        } = priorityTargetIndices(route);
        const addTarget = (primary = false) => {
          const target = newRouteTarget(mode, primary);
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
                      {/* Kept out of the visual row: the shared list tables do
                          not label their row-action column either, and the word
                          needs more than the 48px this column gets, which put a
                          horizontal scrollbar under every route table. */}
                      <span className="sr-only">{t("table.actions")}</span>
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
                  const modelListRequest = targetProvider(
                    providers,
                    target,
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
                              min={0}
                              max={100}
                              step={1}
                              required
                              value={targetNumberValue(target, "weight")}
                              onChange={(event) =>
                                updateTarget(
                                  index,
                                  targetIndex,
                                  withTargetNumber(
                                    target,
                                    "weight",
                                    event.target,
                                  ),
                                )
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
                            value={targetNumberValue(
                              target,
                              "max_inflight_requests",
                            )}
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
                              updateTarget(
                                index,
                                targetIndex,
                                withTargetNumber(
                                  target,
                                  "max_inflight_requests",
                                  event.target,
                                ),
                              )
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
                    model: routeCardModel(route, t),
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
                  value={routeModelSource(modelSources, route)}
                  onChange={(next) =>
                    onModelSourceChange?.(route.model, String(next))
                  }
                  placeholder={
                    impliedSource
                      ? modelSourceLabel(impliedSource)
                      : t("modelSource.placeholder")
                  }
                  options={modelSourceOptions ?? []}
                  disabled={!canChooseModelSource(route)}
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
                  disabled={route.strategyLocked}
                  onChange={(next) => setMode(index, next as Mode)}
                  options={Object.entries(ROUTE_STRATEGY_TEXT).map(
                    ([strategy, text]) => ({
                      label: t(text.label),
                      value: strategy,
                    }),
                  )}
                />
                <p
                  className="text-xs leading-5 text-muted-foreground"
                  aria-live="polite"
                >
                  {t(ROUTE_STRATEGY_TEXT[mode].hint)}
                </p>
              </FormItem>
            </div>
            {mode === "priority" ? (
              <div className="space-y-3">
                <section className="rounded-md bg-[var(--nt-fill-neutral-opaque-1)] p-3 dark:bg-[var(--nt-fill-neutral-opaque-2)]">
                  <h4 className="mb-2 flex items-center gap-1 text-sm font-semibold">
                    {t("external_endpoints.sections.primaryTargets")}
                    <TooltipProvider delayDuration={150}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-foreground"
                            aria-label={t(
                              "external_endpoints.messages.primaryTargetsHint",
                            )}
                          >
                            <CircleHelp
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs leading-relaxed">
                          {t("external_endpoints.messages.primaryTargetsHint")}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
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
                <section className="rounded-md bg-[var(--nt-fill-neutral-opaque-1)] p-3 dark:bg-[var(--nt-fill-neutral-opaque-2)]">
                  <h4 className="mb-2 flex items-center gap-1 text-sm font-semibold">
                    {t("external_endpoints.sections.fallbackTargets")}
                    <TooltipProvider delayDuration={150}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-foreground"
                            aria-label={t(
                              "external_endpoints.messages.fallbackTargetsHint",
                            )}
                          >
                            <CircleHelp
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs leading-relaxed">
                          {t("external_endpoints.messages.fallbackTargetsHint")}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
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
              <div className="rounded-md bg-[var(--nt-fill-neutral-opaque-1)] p-3 dark:bg-[var(--nt-fill-neutral-opaque-2)]">
                {targetTable(
                  mode === "fixed"
                    ? [0]
                    : route.targets.map((_, targetIndex) => targetIndex),
                  // ddu-override: the target table is labelled by its route's model name
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
