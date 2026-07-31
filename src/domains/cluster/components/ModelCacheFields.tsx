import type { UseFormReturnType } from "@refinedev/react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/foundation/components/EmptyState";
import { FormFieldGroup } from "@/foundation/components/FormFieldGroup";
import { FormSelect } from "@/foundation/components/FormSelect";
import { cn } from "@/foundation/lib/utils";
import {
  type CacheType,
  useModelCacheFields,
} from "../hooks/use-model-cache-fields";
import type { Cluster } from "../types";

interface ModelCacheFieldsProps {
  form: UseFormReturnType<Cluster>;
  disabled?: boolean;
  variant?: "card" | "section";
}

export const ModelCacheFields = ({
  form,
  disabled,
  variant = "card",
}: ModelCacheFieldsProps) => {
  const { t } = useTranslation();
  const {
    fields,
    caches,
    isKubernetes,
    canAdd,
    getCacheType,
    switchCacheType,
    addCache,
    removeCache,
    registerField,
    hasFieldError,
  } = useModelCacheFields(form);

  const errorClass = (hasError: boolean, base?: string) =>
    cn(base, hasError && ["border-red-500", "focus:border-red-500"]);
  const cacheItemClassName = cn(
    "relative rounded-[var(--nt-radius-card)] border border-[var(--nt-stroke-neutral-trans-2)]",
    variant === "card"
      ? "bg-[var(--nt-fill-neutral-white)]"
      : "bg-[var(--nt-fill-neutral-opaque-1)]",
  );

  return (
    <div className="col-span-full space-y-4">
      {caches.map((_, index) => {
        const cacheType = getCacheType(index);

        return (
          <div key={fields[index]?.id} className={cacheItemClassName}>
            <div className="flex items-center justify-between gap-3 border-b border-[var(--nt-stroke-neutral-trans-2)] px-4 py-3">
              <div>
                <h3 className="text-sm font-medium leading-5 text-[var(--nt-text-neutral-super)]">
                  #{index + 1} -{" "}
                  {t(`clusters.fields.modelCache.type.${cacheType}`)}
                </h3>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeCache(index)}
                className="h-8 w-8 text-destructive hover:text-destructive"
                disabled={disabled}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4 p-4">
              <div className="grid grid-cols-2 gap-4">
                <FormFieldGroup
                  label={t("common.fields.name")}
                  {...registerField(index, "name")}
                >
                  <Input
                    placeholder={t("clusters.placeholders.modelCacheName")}
                    className={errorClass(hasFieldError(index, "name"))}
                    disabled={disabled}
                  />
                </FormFieldGroup>

                <div className="space-y-2" data-testid="cache-type-select">
                  <Label className="text-sm font-medium">
                    {t("clusters.fields.modelCache.cacheType")}
                  </Label>
                  <FormSelect
                    options={
                      isKubernetes
                        ? [
                            {
                              label: t("clusters.options.hostPath"),
                              value: "host_path",
                            },
                            {
                              label: t("clusters.options.nfs"),
                              value: "nfs",
                            },
                            {
                              label: t("clusters.options.pvc"),
                              value: "pvc",
                            },
                          ]
                        : [
                            {
                              label: t("clusters.options.hostPath"),
                              value: "host_path",
                            },
                          ]
                    }
                    value={cacheType}
                    onChange={(v) => switchCacheType(index, v as CacheType)}
                    disabled={disabled}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {cacheType === "nfs" && (
                  <>
                    <FormFieldGroup
                      label={t("clusters.fields.modelCache.nfsServer")}
                      {...registerField(index, "nfs.server")}
                    >
                      <Input
                        className={errorClass(
                          hasFieldError(index, "nfs.server"),
                        )}
                        disabled={disabled}
                      />
                    </FormFieldGroup>

                    <FormFieldGroup
                      label={t("clusters.fields.modelCache.cachePath")}
                      {...registerField(index, "nfs.path")}
                    >
                      <Input
                        placeholder={t("clusters.placeholders.cachePath")}
                        className={errorClass(hasFieldError(index, "nfs.path"))}
                        disabled={disabled}
                      />
                    </FormFieldGroup>
                  </>
                )}

                {cacheType === "host_path" && (
                  <FormFieldGroup
                    label={t("clusters.fields.modelCache.cachePath")}
                    {...registerField(index, "host_path.path")}
                  >
                    <Input
                      placeholder={t("clusters.placeholders.cachePath")}
                      className={errorClass(
                        hasFieldError(index, "host_path.path"),
                        "col-span-2",
                      )}
                      disabled={disabled}
                    />
                  </FormFieldGroup>
                )}

                {cacheType === "pvc" && (
                  <>
                    <FormFieldGroup
                      label={t("clusters.fields.modelCache.storage")}
                      {...registerField(
                        index,
                        "pvc.resources.requests.storage",
                      )}
                    >
                      <Input
                        placeholder={t("clusters.placeholders.storage")}
                        className={errorClass(
                          hasFieldError(
                            index,
                            "pvc.resources.requests.storage",
                          ),
                        )}
                        disabled={disabled}
                      />
                    </FormFieldGroup>

                    <FormFieldGroup
                      label={t("clusters.fields.modelCache.storageClassName")}
                      {...registerField(index, "pvc.storageClassName")}
                    >
                      <Input
                        placeholder={t(
                          "clusters.placeholders.storageClassName",
                        )}
                        className={errorClass(
                          hasFieldError(index, "pvc.storageClassName"),
                        )}
                        disabled={disabled}
                      />
                    </FormFieldGroup>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {caches.length === 0 && (
        <EmptyState>{t("clusters.messages.noModelCaches")}</EmptyState>
      )}
      {canAdd && !disabled && (
        <div className="flex gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addCache}
            className="flex ml-auto gap-2"
          >
            <Plus className="h-4 w-4" />
            {t("clusters.actions.addModelCache")}
          </Button>
        </div>
      )}
    </div>
  );
};
