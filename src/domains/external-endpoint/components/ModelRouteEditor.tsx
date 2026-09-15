import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormSelect } from "@/foundation/components/FormSelect";
import { useTranslation } from "@/foundation/lib/i18n";
import type { ModelRoute, ModelRouteTarget, UpstreamSpec } from "../types";

type Mode = "fixed" | "priority" | "weighted";

function modeOf(route: ModelRoute): Mode {
  if (route.targets.length <= 1) return "fixed";
  if (route.targets.some((target) => (target.priority ?? 0) !== 0))
    return "priority";
  return "weighted";
}

function targetFor(route: ModelRoute, index: number): ModelRouteTarget {
  const target = route.targets[index] ?? { upstream: "", upstream_model: "" };
  const mode = modeOf(route);
  return {
    ...target,
    priority: mode === "priority" ? index : 0,
    weight: mode === "weighted" ? target.weight || 1 : 1,
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
  const providers = upstreams.map((upstream, index) => ({
    label:
      upstream.name ||
      `${t("external_endpoints.fields.provider")} ${index + 1}`,
    value: upstream.name || `provider-${index + 1}`,
  }));

  const update = (index: number, route: ModelRoute) => {
    const next = value.slice();
    next[index] = route;
    onChange?.(next);
  };

  const setMode = (index: number, mode: Mode) => {
    const route = value[index];
    if (!route) return;
    const targets = route.targets.length
      ? route.targets
      : [{ upstream: "", upstream_model: "" }];
    const normalizedTargets = mode === "fixed" ? targets.slice(0, 1) : targets;
    update(index, {
      ...route,
      targets: normalizedTargets.map((target, targetIndex) => ({
        ...target,
        priority: mode === "priority" ? targetIndex : 0,
        weight: mode === "weighted" ? target.weight || 1 : 1,
      })),
    });
  };

  return (
    <div className="space-y-4">
      {value.map((route, index) => {
        const mode = modeOf(route);
        return (
          <div
            key={`${route.model}-${index}`}
            className="rounded border border-border/60 p-4 space-y-4"
          >
            <div className="grid grid-cols-2 gap-4 xs:grid-cols-1">
              <Input
                value={route.model}
                onChange={(event) =>
                  update(index, { ...route, model: event.target.value })
                }
                placeholder={t("external_endpoints.placeholders.virtualModel")}
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
              />
            </div>
            <div className="space-y-2">
              {route.targets.map((_, targetIndex) => {
                const target = targetFor(route, targetIndex);
                return (
                  <div
                    key={targetIndex}
                    className="grid grid-cols-[1fr_1fr_auto_auto] gap-3 xs:grid-cols-1"
                  >
                    <FormSelect
                      value={target.upstream}
                      onChange={(next) => {
                        const targets = route.targets.slice();
                        targets[targetIndex] = { ...target, upstream: next };
                        update(index, { ...route, targets });
                      }}
                      options={providers}
                      placeholder={t(
                        "external_endpoints.placeholders.selectProvider",
                      )}
                    />
                    <Input
                      value={target.upstream_model}
                      onChange={(event) => {
                        const targets = route.targets.slice();
                        targets[targetIndex] = {
                          ...target,
                          upstream_model: event.target.value,
                        };
                        update(index, { ...route, targets });
                      }}
                      placeholder={t(
                        "external_endpoints.placeholders.upstreamModelName",
                      )}
                      aria-label={t(
                        "external_endpoints.fields.upstreamModelName",
                      )}
                    />
                    <Input
                      type="number"
                      min={0}
                      value={target.max_inflight_requests ?? 0}
                      onChange={(event) => {
                        const targets = route.targets.slice();
                        targets[targetIndex] = {
                          ...target,
                          max_inflight_requests: Math.max(
                            0,
                            Number(event.target.value) || 0,
                          ),
                        };
                        update(index, { ...route, targets });
                      }}
                      aria-label="Max inflight requests"
                      placeholder="Max concurrent requests"
                      className="w-36"
                    />
                    <div className="flex items-center gap-2">
                      {mode === "weighted" && (
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={target.weight ?? 0}
                          onChange={(event) => {
                            const targets = route.targets.slice();
                            targets[targetIndex] = {
                              ...target,
                              weight: Math.min(100, Math.max(0, Number(event.target.value) || 0)),
                            };
                            update(index, { ...route, targets });
                          }}
                          aria-label={t("external_endpoints.fields.weight")}
                          placeholder="Percent"
                          className="w-20"
                        />
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          update(index, {
                            ...route,
                            targets: route.targets.filter(
                              (_, i) => i !== targetIndex,
                            ),
                          })
                        }
                        disabled={route.targets.length <= 1}
                        aria-label={t(
                          "external_endpoints.actions.removeTarget",
                        )}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
              {mode !== "fixed" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    update(index, {
                      ...route,
                      targets: [
                        ...route.targets,
                        { upstream: "", upstream_model: "" },
                      ],
                    })
                  }
                >
                  <Plus className="mr-1 h-4 w-4" />
                  {t("external_endpoints.actions.addTarget")}
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4 xs:grid-cols-1">
              <FormSelect
                value={route.max_attempts ? "enabled" : "disabled"}
                onChange={(next) =>
                  update(
                    index,
                    next === "enabled"
                      ? {
                          ...route,
                          retryable_conditions: [
                            "http_429",
                            "http_502",
                            "http_503",
                            "http_504",
                            "timeout",
                          ],
                          max_attempts: 1,
                        }
                      : { ...route, retryable_conditions: [], max_attempts: 0 },
                  )
                }
                options={[
                  {
                    label: t("external_endpoints.options.noRetry"),
                    value: "disabled",
                  },
                  {
                    label: t("external_endpoints.options.retryProvider"),
                    value: "enabled",
                  },
                ]}
              />
            </div>
          </div>
        );
      })}
      <Button
        type="button"
        variant="outline"
        onClick={() =>
          onChange?.([
            ...value,
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
