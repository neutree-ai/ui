import { Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormSelect } from "@/foundation/components/FormSelect";
import { useTranslation } from "@/foundation/lib/i18n";
import type { ModelRoute, ModelRouteTarget, UpstreamSpec } from "../types";

type Mode = "fixed" | "priority" | "weighted";

const sameRoutes = (left: ModelRoute[], right: ModelRoute[]) =>
  JSON.stringify(left) === JSON.stringify(right);

function modeOf(route: ModelRoute): Mode {
  if (route.strategy) return route.strategy;
  if (route.targets.length <= 1) return "fixed";
  return route.targets.some((target) => (target.priority ?? 0) !== 0)
    ? "priority"
    : "weighted";
}

function targetFor(
  route: ModelRoute,
  index: number,
  mode: Mode,
): ModelRouteTarget {
  const target = route.targets[index] ?? {
    upstream: "",
    upstream_model: "",
  };
  return {
    ...target,
    priority: mode === "priority" ? index : 0,
    weight: mode === "weighted" ? target.weight : undefined,
  };
}

type Props = {
  value?: ModelRoute[];
  onChange?: (value: ModelRoute[]) => void;
  upstreams: UpstreamSpec[];
  onQuickCreate?: (routeIndex: number, targetIndex: number) => void;
};

export default function ModelRouteEditor({
  value = [],
  onChange,
  upstreams,
  onQuickCreate,
}: Props) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<ModelRoute[]>(value);
  const [modes, setModes] = useState<Record<string, Mode>>({});
  const lastExternalValue = useRef(value);
  const routeIds = useRef<string[]>([]);
  const draftRef = useRef<ModelRoute[]>(value);
  const nextRouteId = useRef(0);

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
    const key = routeIds.current[index];
    setModes((current) => ({ ...current, [key]: mode }));
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
  ) => {
    const route = draft[routeIndex];
    if (!route) return;
    const targets = route.targets.slice();
    targets[targetIndex] = target;
    updateDraft(routeIndex, { ...route, targets });
  };

  return (
    <div className="space-y-4">
      {draft.map((route, index) => {
        const key = routeIds.current[index];
        const mode = modes[key] ?? modeOf(route);
        const targetRow = (targetIndex: number) => {
          const target = targetFor(route, targetIndex, mode);
          return (
            <div
              key={targetIndex}
              className={`grid items-end gap-3 xs:grid-cols-1 ${
                mode === "weighted"
                  ? "grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]"
                  : "grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
              }`}
            >
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
                  if (next === "__quick_create_upstream__") {
                    onQuickCreate?.(index, targetIndex);
                    return;
                  }
                  commit(
                    draft.map((item, itemIndex) =>
                      itemIndex === index
                        ? {
                            ...item,
                            targets: item.targets.map((itemTarget, i) =>
                              i === targetIndex
                                ? { ...target, upstream: next }
                                : itemTarget,
                            ),
                          }
                        : item,
                    ),
                  );
                }}
                aria-label={t("external_endpoints.fields.provider")}
              />
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
                aria-label={t("external_endpoints.fields.upstreamModelName")}
              />
              {mode === "weighted" ? (
                <div className="w-24 space-y-1 xs:w-full">
                  <span className="text-xs font-medium text-muted-foreground">
                    {t("external_endpoints.fields.weight")}
                  </span>
                  <div className="relative">
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={target.weight ?? ""}
                      onChange={(event) => {
                        const rawValue = event.target.value;
                        updateTarget(index, targetIndex, {
                          ...target,
                          // Keep the input empty while the user replaces the
                          // current value; coercing it to 1 here resets the
                          // controlled input before the next keystroke.
                          weight:
                            rawValue === ""
                              ? undefined
                              : Math.min(100, Math.max(1, Number(rawValue))),
                        });
                      }}
                      onBlur={commitDraft}
                      aria-label={t("external_endpoints.fields.weight")}
                      placeholder={t("external_endpoints.placeholders.weight")}
                      className="w-full pr-7"
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                      %
                    </span>
                  </div>
                </div>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="justify-self-end text-muted-foreground hover:bg-muted hover:text-foreground"
                disabled={route.targets.length <= 1}
                aria-label={t("external_endpoints.actions.removeTarget")}
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
            </div>
          );
        };
        const primaryTargetIndices = route.targets
          .map((target, targetIndex) =>
            (target.priority ?? 0) === 0 ? targetIndex : -1,
          )
          .filter((targetIndex) => targetIndex >= 0);
        const fallbackTargetIndices = route.targets
          .map((target, targetIndex) =>
            (target.priority ?? 0) > 0 ? targetIndex : -1,
          )
          .filter((targetIndex) => targetIndex >= 0);
        const addTarget = (primary = false) =>
          commit(
            draft.map((item, itemIndex) =>
              itemIndex === index
                ? {
                    ...item,
                    targets: primary
                      ? [
                          ...item.targets,
                          { upstream: "", upstream_model: "", priority: 0 },
                        ]
                      : [
                          ...item.targets,
                          {
                            upstream: "",
                            upstream_model: "",
                            ...(mode === "weighted"
                              ? {}
                              : {
                                  priority:
                                    Math.max(
                                      0,
                                      ...item.targets.map(
                                        (target) => target.priority ?? 0,
                                      ),
                                    ) + 1,
                                }),
                          },
                        ],
                  }
                : item,
            ),
          );
        return (
          <div key={key} className="rounded-md bg-muted/35 p-4">
            <div className="mb-4 flex items-start gap-3">
              <div className="grid min-w-0 flex-1 grid-cols-2 gap-4 xs:grid-cols-1">
                <Input
                  value={route.model}
                  onChange={(event) =>
                    updateDraft(index, { ...route, model: event.target.value })
                  }
                  onBlur={commitDraft}
                  placeholder={t(
                    "external_endpoints.placeholders.virtualModel",
                  )}
                  aria-label={t("external_endpoints.fields.virtualModel")}
                />
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
                  aria-label={t("external_endpoints.fields.routingMode")}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t("external_endpoints.actions.removeVirtualModel")}
                onClick={() => {
                  const next = draft.filter(
                    (_, itemIndex) => itemIndex !== index,
                  );
                  setModes((current) => {
                    const copy = { ...current };
                    delete copy[key];
                    return copy;
                  });
                  commit(next);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            {mode === "priority" ? (
              <div className="space-y-5 rounded-md bg-background/70 p-4">
                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-foreground">
                      {t("external_endpoints.sections.primaryTargets")}
                    </h3>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addTarget(true)}
                    >
                      <Plus className="mr-1 h-4 w-4" />
                      {t("external_endpoints.actions.addPrimaryTarget")}
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {primaryTargetIndices.map((targetIndex) =>
                      targetRow(targetIndex),
                    )}
                  </div>
                </section>
                <section className="space-y-3 border-t border-border/50 pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-foreground">
                      {t("external_endpoints.sections.fallbackTargets")}
                    </h3>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addTarget(false)}
                    >
                      <Plus className="mr-1 h-4 w-4" />
                      {t("external_endpoints.actions.addFallbackTarget")}
                    </Button>
                  </div>
                  {fallbackTargetIndices.length > 0 ? (
                    <div className="space-y-3">
                      {fallbackTargetIndices.map((targetIndex) =>
                        targetRow(targetIndex),
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {t("external_endpoints.messages.noFallbackTargets")}
                    </p>
                  )}
                </section>
              </div>
            ) : (
              <div className="space-y-3">
                {route.targets.map((_, targetIndex) => targetRow(targetIndex))}
              </div>
            )}
            {mode === "weighted" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addTarget(false)}
              >
                <Plus className="mr-1 h-4 w-4" />
                {t("external_endpoints.actions.addTarget")}
              </Button>
            )}
          </div>
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
