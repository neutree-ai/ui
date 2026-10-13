import { zcacheSpec } from "@/domains/cluster/types";
import { AlertCircle } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { FormFieldGroup } from "@/foundation/components/FormFieldGroup";
import { InfoHint } from "@/foundation/components/InfoHint";
import { useSystemApi } from "@/foundation/hooks/use-system-api";
import type { EndpointClusterRef } from "../types";

export function EndpointZCacheFields({
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
  const cache = form.watch("spec.kv_cache");
  const enabled = cache != null;
  const engine = form.watch("spec.engine");
  const supported =
    cluster?.spec.type === "kubernetes" &&
    zcacheSpec(cluster)?.enabled &&
    engine?.engine === "vllm";
  if (cache?.provider && cache.provider !== "zcache") return null;
  if (!systemInfo?.capabilities?.cluster_cache_providers?.includes("zcache") && !enabled) return null;
  return (
    <section
      className="overflow-hidden rounded-md border bg-card"
      data-testid="endpoint-zcache"
    >
      <div className="flex items-center justify-between gap-3 bg-muted/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <label
            htmlFor="endpoint-zcache-enabled"
            className="text-sm font-medium"
          >
            {t("endpoints.zcache.enable")}
          </label>
          <InfoHint
            label={t(
              supported
                ? "endpoints.zcache.scheduling"
                : "endpoints.zcache.requirements",
            )}
          />
        </div>
        <Switch
          id="endpoint-zcache-enabled"
          checked={enabled}
          disabled={!enabled && !supported}
          onCheckedChange={(value) =>
            form.setValue(
              "spec.kv_cache",
              value ? {
                provider: "zcache",
                options: { timeout_seconds:
                  form.getValues("spec.kv_cache.options.timeout_seconds") ?? 5 },
              } : null,
              { shouldDirty: true, shouldValidate: true },
            )
          }
        />
      </div>
      {enabled && !supported && (
        <p role="alert" className="px-4 pt-3 text-sm text-destructive">
          {t("endpoints.zcache.requirements")}
        </p>
      )}
      {enabled && (
        <div className="space-y-5 p-4">
          <div className="max-w-sm">
            <FormFieldGroup
              {...form}
              name="spec.kv_cache.provider"
              label={t("endpoints.zcache.providerLabel")}
              rules={{ validate: (value) => !form.getValues("spec.kv_cache") || Boolean(value) || t("endpoints.zcache.selectProvider") }}
            >
              <Select value={cache?.provider ?? ""} onValueChange={(provider) => form.setValue("spec.kv_cache", {
                provider,
                options: { timeout_seconds: cache?.options?.timeout_seconds ?? 5 },
              }, { shouldDirty: true, shouldValidate: true })}>
                <SelectTrigger><SelectValue placeholder={t("endpoints.zcache.selectProvider")} /></SelectTrigger>
                <SelectContent><SelectItem value="zcache">ZCache</SelectItem></SelectContent>
              </Select>
            </FormFieldGroup>
          </div>
          {cache?.provider === "zcache" && <div className="border-t pt-5">
          <div className="max-w-sm">
            <FormFieldGroup
              {...form}
              name="spec.kv_cache.options.timeout_seconds"
              label={t("endpoints.zcache.timeout")}
              rules={{
                validate: (value) =>
                  form.getValues("spec.kv_cache.provider") !== "zcache" ||
                  value === undefined ||
                  (Number.isFinite(value) &&
                    Number(value) >= 0.1 &&
                    Number(value) <= 60) ||
                  t("endpoints.zcache.invalidTimeout"),
              }}
            >
              <Input
                type="number"
                min={0.1}
                max={60}
                step={0.1}
                value={form.watch("spec.kv_cache.options.timeout_seconds") ?? 5}
                onChange={(event) =>
                  form.setValue(
                    "spec.kv_cache.options.timeout_seconds",
                    Number(event.target.value),
                    { shouldDirty: true, shouldValidate: true },
                  )
                }
              />
            </FormFieldGroup>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("endpoints.zcache.timeoutHint")}
            </p>
          </div>
          </div>}
        </div>
      )}
      {isEdit && form.formState.dirtyFields.spec?.kv_cache && (
        <p role="status" className="flex items-center gap-2 border-t border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {t("endpoints.zcache.redeploy")}
        </p>
      )}
    </section>
  );
}
