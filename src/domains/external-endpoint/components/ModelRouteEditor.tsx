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
    weight: mode === "weighted" ? target.weight : 1,
  };
}

type Props = {
  value?: ModelRoute[];
  onChange?: (value: ModelRoute[]) => void;
  upstreams: UpstreamSpec[];
};

export default function ModelRouteEditor({
  value = [],
  onChange,
  upstreams,
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
          ? { upstream: "", upstream_model: "", weight: 50 }
          : { upstream: "", upstream_model: "", priority: 1 },
      ];
      if (mode === "weighted") targets[0] = { ...targets[0], weight: 50 };
    }

    const normalized = targets.map((target, targetIndex) => ({
      ...target,
      priority: mode === "priority" ? targetIndex : 0,
      weight: mode === "weighted" ? target.weight || 1 : 1,
    }));
    const key = routeIds.current[index];
    setModes((current) => ({ ...current, [key]: mode }));
    commit(
      draft.map((item, itemIndex) =>
        itemIndex === index ? { ...route, targets: normalized } : item,
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
        return (
          <div key={key} className="rounded border border-border/60 p-4">
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

            <div className="space-y-2">
              {route.targets.map((_, targetIndex) => {
                const target = targetFor(route, targetIndex, mode);
                return (
                  <div
                    key={targetIndex}
                    className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] gap-3 xs:grid-cols-1"
                  >
                    <FormSelect
                      value={target.upstream}
                      onChange={(next) =>
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
                        )
                      }
                      options={providers}
                      placeholder={t(
                        "external_endpoints.placeholders.selectProvider",
                      )}
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
                      aria-label={t(
                        "external_endpoints.fields.upstreamModelName",
                      )}
                    />
                    {mode === "priority" && (
                      <Input
                        type="number"
                        min={0}
                        value={target.max_inflight_requests ?? 0}
                        onChange={(event) =>
                          updateTarget(index, targetIndex, {
                            ...target,
                            max_inflight_requests: Math.max(
                              0,
                              Number(event.target.value) || 0,
                            ),
                          })
                        }
                        onBlur={commitDraft}
                        aria-label={t(
                          "external_endpoints.fields.maxInflightRequests",
                        )}
                        placeholder={t(
                          "external_endpoints.placeholders.maxInflightRequests",
                        )}
                        className="w-36"
                      />
                    )}
                    {mode === "weighted" && (
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={target.weight ?? ""}
                        onChange={(event) =>
                          updateTarget(index, targetIndex, {
                            ...target,
                            weight: Math.min(
                              100,
                              Math.max(1, Number(event.target.value) || 1),
                            ),
                          })
                        }
                        onBlur={commitDraft}
                        aria-label={t("external_endpoints.fields.weight")}
                        placeholder={t(
                          "external_endpoints.placeholders.weight",
                        )}
                        className="w-24"
                      />
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
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
              })}
              {mode !== "fixed" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    commit(
                      draft.map((item, itemIndex) =>
                        itemIndex === index
                          ? {
                              ...item,
                              targets: [
                                ...item.targets,
                                mode === "weighted"
                                  ? {
                                      upstream: "",
                                      upstream_model: "",
                                      weight: 1,
                                    }
                                  : {
                                      upstream: "",
                                      upstream_model: "",
                                      priority: item.targets.length,
                                    },
                              ],
                            }
                          : item,
                      ),
                    )
                  }
                >
                  <Plus className="mr-1 h-4 w-4" />
                  {t("external_endpoints.actions.addTarget")}
                </Button>
              )}
            </div>
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
