import type { UseFormReturnType } from "@refinedev/react-hook-form";
import { useTranslation } from "react-i18next";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import FormCardGrid from "@/foundation/components/FormCardGrid";
import { FormFieldGroup } from "@/foundation/components/FormFieldGroup";
import type { Cluster } from "../types";

export function ZCacheFields({
  form,
  isEdit,
}: {
  form: UseFormReturnType<Cluster>;
  isEdit: boolean;
}) {
  const { t } = useTranslation();
  const enabled = form.watch("spec.zcache.enabled") === true;
  const selected: string[] = form.watch("spec.zcache.target_nodes") ?? [];
  const status = form.refineCore.query?.data?.data.status?.zcache;
  const candidates = status?.candidates ?? [];
  const names = [...new Set([...candidates.map((n) => n.name), ...selected])];
  return (
    <FormCardGrid title={t("clusters.zcache.title")} variant="section">
      <p className="col-span-full text-sm text-muted-foreground">
        {t(isEdit ? "clusters.zcache.saveHint" : "clusters.zcache.createHint")}
      </p>
      {status?.phase === "Failed" && (
        <p className="col-span-full text-sm">
          {t("clusters.zcache.retryHint")}
        </p>
      )}
      {isEdit && (
        <>
          <FormFieldGroup
            {...form}
            name="spec.zcache.enabled"
            label={t("clusters.zcache.enable")}
            isCheckbox
            className="col-span-full"
          >
            <Checkbox
              checked={enabled}
              onCheckedChange={(value) =>
                form.setValue(
                  "spec.zcache",
                  {
                    enabled: value === true,
                    l1_size_gib:
                      Number.isInteger(
                        form.getValues("spec.zcache.l1_size_gib"),
                      ) && form.getValues("spec.zcache.l1_size_gib") > 0
                        ? form.getValues("spec.zcache.l1_size_gib")
                        : 1,
                    target_nodes: selected,
                  },
                  { shouldDirty: true, shouldValidate: true },
                )
              }
            />
          </FormFieldGroup>
          {enabled && (
            <>
              <FormFieldGroup
                {...form}
                name="spec.zcache.l1_size_gib"
                label={t("clusters.zcache.capacity")}
                rules={{
                  validate: (value) =>
                    form.getValues("spec.zcache.enabled") !== true ||
                    (Number.isInteger(Number(value)) &&
                      Number(value) >= 1 &&
                      Number(value) <= 2147483647) ||
                    t("clusters.zcache.invalidCapacity"),
                }}
              >
                <Input
                  type="number"
                  min={1}
                  step={1}
                  onChange={(event) =>
                    form.setValue(
                      "spec.zcache.l1_size_gib",
                      Number(event.target.value),
                      { shouldDirty: true, shouldValidate: true },
                    )
                  }
                />
              </FormFieldGroup>
              <div className="col-span-full space-y-2">
                <p className="text-sm">{t("clusters.zcache.targetNodes")}</p>
                {status?.observation_error && (
                  <p role="alert" className="text-sm text-destructive">
                    {t("clusters.zcache.stale")} {status.observation_error}
                  </p>
                )}
                {names.length === 0 && (
                  <p>{t("clusters.zcache.noCandidates")}</p>
                )}
                {names.map((name) => {
                  const candidate = candidates.find((n) => n.name === name);
                  const node = status?.nodes?.find((n) => n.name === name);
                  return (
                    <label
                      key={name}
                      htmlFor={`zcache-node-${name}`}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Checkbox
                        id={`zcache-node-${name}`}
                        aria-label={name}
                        checked={selected.includes(name)}
                        disabled={
                          !selected.includes(name) &&
                          (!candidate?.selectable ||
                            !!status?.observation_error)
                        }
                        onCheckedChange={(checked) =>
                          form.setValue(
                            "spec.zcache.target_nodes",
                            checked === true
                              ? [...selected, name]
                              : selected.filter((n) => n !== name),
                            { shouldDirty: true, shouldValidate: true },
                          )
                        }
                      />
                      <span>{name}</span>
                      <span className="text-muted-foreground">
                        {node
                          ? t(
                              node.runtime === "Ready"
                                ? "clusters.zcache.ready"
                                : "clusters.zcache.notReady",
                            )
                          : candidate?.reason}
                      </span>
                    </label>
                  );
                })}
                <input
                  type="hidden"
                  {...form.register("spec.zcache.target_nodes", {
                    validate: (value) =>
                      form.getValues("spec.zcache.enabled") !== true ||
                      (value?.length ?? 0) > 0 ||
                      t("clusters.zcache.selectNodes"),
                  })}
                />
                {form.getFieldState("spec.zcache.target_nodes", form.formState)
                  .error && (
                  <p role="alert" className="text-sm text-destructive">
                    {t("clusters.zcache.selectNodes")}
                  </p>
                )}
              </div>
            </>
          )}
        </>
      )}
    </FormCardGrid>
  );
}
