import { AlertCircle } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { endpointZCacheOptions } from "@/domains/endpoint/lib/zcache";
import { FormFieldGroup } from "@/foundation/components/FormFieldGroup";
import { InfoHint } from "@/foundation/components/InfoHint";
import { useCacheVersions } from "@/foundation/hooks/use-cache-versions";
import { useSystemApi } from "@/foundation/hooks/use-system-api";
import type { EndpointClusterRef } from "../types";

export function EndpointKVCacheFields({
  form,
  cluster,
  isEdit,
}: {
  form: UseFormReturn;
  cluster?: EndpointClusterRef;
  isEdit: boolean;
}) {
  const { t } = useTranslation();
  const { systemInfo } = useSystemApi();
  const versions = useCacheVersions(
    systemInfo?.capabilities?.cluster_cache_providers?.includes("zcache") ===
      true,
  );
  const cache = form.watch("spec.kv_cache");
  const enabled = cache != null;
  const engine = form.watch("spec.engine");
  const task = form.watch("spec.model.task");
  const runtimeVersion = endpointZCacheOptions(cluster)?.version;
  const compatible = !!versions.data?.data
    .find((v) => v.version === runtimeVersion)
    ?.engine_versions.includes(engine?.version);
  const supported =
    cluster?.spec.type === "kubernetes" &&
    endpointZCacheOptions(cluster)?.enabled &&
    engine?.engine === "vllm" &&
    (!task || task === "text-generation") &&
    compatible;
  form.register("spec.kv_cache", {
    validate: (value) =>
      value?.provider !== "zcache" ||
      !!supported ||
      t("endpoints.kvCacheSettings.requirements"),
  });
  if (cache?.provider && cache.provider !== "zcache") return null;
  if (
    !systemInfo?.capabilities?.cluster_cache_providers?.includes("zcache") &&
    !enabled
  )
    return null;
  return (
    <section
      className="overflow-hidden rounded-md border bg-card"
      data-testid="endpoint-kv-cache"
    >
      <div className="flex items-center justify-between gap-3 bg-muted/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <label
            htmlFor="endpoint-kv-cache-enabled"
            className="text-sm font-medium"
          >
            {t("endpoints.kvCacheSettings.enable")}
          </label>
          <InfoHint
            label={t(
              supported
                ? "endpoints.kvCacheSettings.scheduling"
                : "endpoints.kvCacheSettings.requirements",
            )}
          />
        </div>
        <Switch
          id="endpoint-kv-cache-enabled"
          checked={enabled}
          disabled={!enabled && !supported}
          onCheckedChange={(value) =>
            form.setValue(
              "spec.kv_cache",
              value
                ? {
                    provider: "zcache",
                    options: {
                      timeout_seconds:
                        form.getValues(
                          "spec.kv_cache.options.timeout_seconds",
                        ) ?? 5,
                    },
                  }
                : null,
              { shouldDirty: true, shouldValidate: true },
            )
          }
        />
      </div>
      {enabled && !supported && (
        <p role="alert" className="px-4 pt-3 text-sm text-destructive">
          {t(
            compatible
              ? "endpoints.kvCacheSettings.requirements"
              : "clusters.cacheUpgrade.incompatible",
          )}
        </p>
      )}
      {enabled && (
        <div className="space-y-5 p-4">
          {cache?.provider && (
            <div>
              <div className="max-w-sm">
                <FormFieldGroup
                  {...form}
                  name="spec.kv_cache.options.timeout_seconds"
                  label={t("endpoints.kvCacheSettings.timeout")}
                  rules={{
                    validate: (value) =>
                      !form.getValues("spec.kv_cache.provider") ||
                      value === undefined ||
                      (Number.isFinite(value) &&
                        Number(value) >= 0.1 &&
                        Number(value) <= 60) ||
                      t("endpoints.kvCacheSettings.invalidTimeout"),
                  }}
                >
                  <Input
                    type="number"
                    min={0.1}
                    max={60}
                    step={0.1}
                    value={
                      form.watch("spec.kv_cache.options.timeout_seconds") ?? 5
                    }
                    onChange={(event) =>
                      form.setValue(
                        "spec.kv_cache.options.timeout_seconds",
                        event.target.value === ""
                          ? ""
                          : Number(event.target.value),
                        { shouldDirty: true, shouldValidate: true },
                      )
                    }
                  />
                </FormFieldGroup>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("endpoints.kvCacheSettings.timeoutHint")}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
      {isEdit && form.formState.dirtyFields.spec?.kv_cache && (
        <p
          role="status"
          className="flex items-center gap-2 border-t border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-400"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          {t("endpoints.kvCacheSettings.redeploy")}
        </p>
      )}
    </section>
  );
}
