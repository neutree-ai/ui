import { Plus, Trash2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormSelect } from "@/foundation/components/FormSelect";
import { useTranslation } from "@/foundation/lib/i18n";
import type { ModelRoute, ModelRouteTarget, UpstreamSpec } from "../types";

type Mode = "fixed" | "priority" | "weighted";

const sameRoutes = (left: ModelRoute[], right: ModelRoute[]) =>
  JSON.stringify(left) === JSON.stringify(right);

type Props = {
  value?: ModelRoute[];
  onChange?: (value: ModelRoute[]) => void;
  upstreams: UpstreamSpec[];
  onQuickCreate?: (routeIndex: number, targetIndex: number) => void;
  focusModel?: string;
};

export default function ModelRouteEditor({
  value = [],
  onChange,
  upstreams,
  onQuickCreate,
  focusModel,
}: Props) {
  const { t } = useTranslation();
  const editorId = useId();
  const [draft, setDraft] = useState<ModelRoute[]>(value);
  const lastExternalValue = useRef(value);
  const routeIds = useRef<string[]>([]);
  const draftRef = useRef<ModelRoute[]>(value);
  const nextRouteId = useRef(0);
  const editor = useRef<HTMLDivElement>(null);
  const focusedModel = useRef<string>();
  const focusIndex = draft.findIndex((route) => route.model === focusModel);

  const ensureRouteIds = (length: number) => {
    while (routeIds.current.length < length) {
      routeIds.current.push(`route-${nextRouteId.current++}`);
    }
    routeIds.current = routeIds.current.slice(0, length);
  };

  useEffect(() => {
    if (!sameRoutes(value, lastExternalValue.current)) {
      setDraft(value);
      draftRef.current = value;
      lastExternalValue.current = value;
    }
  }, [value]);

  useEffect(() => {
    if (!focusModel || focusedModel.current === focusModel || focusIndex < 0)
      return;
    const card = editor.current?.children.item(focusIndex);
    card?.scrollIntoView({ block: "center" });
    card?.querySelector("input")?.focus({ preventScroll: true });
    focusedModel.current = focusModel;
  }, [focusModel, focusIndex]);

  ensureRouteIds(draft.length);

  const providers = upstreams.map((upstream, index) => ({
    label:
      upstream.name ||
      `${t("external_endpoints.fields.provider")} ${index + 1}`,
    value: upstream.name || `provider-${index + 1}`,
  }));

  const commit = (next: ModelRoute[]) => {
    setDraft(next);
    draftRef.current = next;
    ensureRouteIds(next.length);
    lastExternalValue.current = next;
    onChange?.(next);
  };

  const updateDraft = (index: number, route: ModelRoute) => {
    setDraft((current) => {
      const next = current.slice();
      next[index] = route;
      draftRef.current = next;
      return next;
    });
  };

  const commitDraft = () => commit(draftRef.current);

  const setMode = (index: number, mode: Mode) => {
    const route = draft[index];
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
    }));
    commit(
      draft.map((item, itemIndex) =>
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
    immediate = false,
  ) => {
    const route = draft[routeIndex];
    if (!route) return;
    const targets = route.targets.slice();
    targets[targetIndex] = target;
    if (immediate) {
      commit(
        draft.map((item, i) =>
          i === routeIndex ? { ...route, targets } : item,
        ),
      );
    } else {
      updateDraft(routeIndex, { ...route, targets });
    }
  };

  return (
    <div ref={editor} className="space-y-4">
      {draft.map((route, index) => {
        const key = routeIds.current[index];
        const mode = route.strategy ?? "fixed";
        const hasActions = mode !== "fixed";
        const weightTotal = route.targets.reduce(
          (sum, target) => sum + (target.weight ?? 0),
          0,
        );
        const weightTotalId = `${editorId}-${key}-weight-total`;
        const modelInputId = `${editorId}-${key}-model`;
        const strategyInputId = `${editorId}-${key}-strategy`;
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
            draft.map((item, itemIndex) =>
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
                  return (
                    <tr key={targetIndex}>
                      <td>
                        <FormSelect
                          id={`${editorId}-${key}-${targetIndex}-provider`}
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
                          aria-label={t("external_endpoints.fields.provider")}
                          onChange={(next) => {
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
                              draft.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, targets }
                                  : item,
                              ),
                            );
                          }}
                        />
                      </td>
                      <td>
                        <Input
                          value={target.upstream_model}
                          onChange={(event) =>
                            updateTarget(index, targetIndex, {
                              ...target,
                              upstream_model: event.target.value,
                            })
                          }
                          onBlur={commitDraft}
                          placeholder={t(
                            "external_endpoints.placeholders.upstreamModelName",
                          )}
                          aria-label={t(
                            "external_endpoints.fields.upstreamModelName",
                          )}
                        />
                      </td>
                      <td>
                        {mode === "weighted" ? (
                          <div className="relative">
                            <Input
                              type="number"
                              aria-invalid={weightTotal !== 100}
                              aria-describedby={weightTotalId}
                              min={1}
                              max={100}
                              value={target.weight ?? ""}
                              onChange={(event) =>
                                updateTarget(
                                  index,
                                  targetIndex,
                                  {
                                    ...target,
                                    weight:
                                      event.target.value === ""
                                        ? undefined
                                        : Math.min(
                                            100,
                                            Math.max(
                                              1,
                                              Number(event.target.value),
                                            ),
                                          ),
                                  },
                                  true,
                                )
                              }
                              onBlur={commitDraft}
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
                            onBlur={commitDraft}
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
                            disabled={route.targets.length <= 1}
                            aria-label={t(
                              "external_endpoints.actions.removeTarget",
                            )}
                            onClick={() =>
                              commit(
                                draft.map((item, itemIndex) =>
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
                  commit(draft.filter((_, itemIndex) => itemIndex !== index));
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="mb-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                    updateDraft(index, { ...route, model: event.target.value })
                  }
                  onBlur={commitDraft}
                  placeholder={t(
                    "external_endpoints.placeholders.virtualModel",
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor={strategyInputId}
                  className="text-xs font-medium text-muted-foreground"
                >
                  {t("external_endpoints.fields.routingMode")}
                </label>
                <FormSelect
                  id={strategyInputId}
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
                  aria-label={t("external_endpoints.fields.routingMode")}
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
              </div>
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
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("external_endpoints.messages.primaryCapacityRequired")}
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
                        weightTotal === 100
                          ? "text-sm text-green-700 dark:text-green-400"
                          : "text-sm text-destructive"
                      }
                    >
                      {t(
                        weightTotal === 100
                          ? "external_endpoints.messages.weightTotalValid"
                          : "external_endpoints.messages.weightTotalInvalid",
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
            ...draft,
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
