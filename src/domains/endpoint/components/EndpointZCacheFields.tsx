import type { UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
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
  const enabled = form.watch("spec.zcache.enabled") === true;
  const engine = form.watch("spec.engine");
  const supported =
    cluster?.spec.type === "kubernetes" &&
    cluster.spec.zcache?.enabled &&
    engine?.engine === "vllm" &&
    engine.version === "v0.24.0";
  if (!systemInfo?.capabilities?.zcache && !enabled) return null;
  return (
    <section
      className="rounded-md border bg-background p-3 space-y-3"
      data-testid="endpoint-zcache"
    >
      <div className="flex items-center justify-between gap-3">
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
              "spec.zcache",
              value ? {
                enabled: true,
                timeout_seconds:
                  form.getValues("spec.zcache.timeout_seconds") ?? 5,
              } : { enabled: false },
              { shouldDirty: true, shouldValidate: true },
            )
          }
        />
      </div>
      {enabled && !supported && (
        <p role="alert" className="text-sm text-destructive">
          {t("endpoints.zcache.requirements")}
        </p>
      )}
      {enabled && (
        <details>
          <summary className="cursor-pointer text-sm text-muted-foreground">
            {t("endpoints.zcache.advanced")}
          </summary>
          <div className="mt-3 max-w-sm">
            <FormFieldGroup
              {...form}
              name="spec.zcache.timeout_seconds"
              label={t("endpoints.zcache.timeout")}
              rules={{
                validate: (value) =>
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
                value={form.watch("spec.zcache.timeout_seconds") ?? 5}
                onChange={(event) =>
                  form.setValue(
                    "spec.zcache.timeout_seconds",
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
        </details>
      )}
      {isEdit && form.formState.dirtyFields.spec?.zcache && (
        <p role="status" className="text-sm text-amber-700 dark:text-amber-400">
          {t("endpoints.zcache.redeploy")}
        </p>
      )}
    </section>
  );
}
