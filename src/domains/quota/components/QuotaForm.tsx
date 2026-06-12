import { useList } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FieldValues } from "react-hook-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  QUOTA_DIMENSION_TYPES,
  QUOTA_LEVELS,
  QUOTA_PERIODS,
  type QuotaApiKeyLite,
  type QuotaDimensionType,
  type QuotaLevel,
  type QuotaNamedLite,
  type QuotaPeriod,
  type QuotaUserLite,
  type QuotaWorkspaceLite,
} from "@/domains/quota/types";
import type { SetQuotaParams } from "@/domains/quota/hooks/use-quota";
import { FormCombobox } from "@/foundation/components/FormCombobox";
import { FormFieldGroup } from "@/foundation/components/FormFieldGroup";
import { useRefineFieldArray } from "@/foundation/hooks/use-refine-field-array";
import { ALL_WORKSPACES } from "@/foundation/hooks/use-workspace";
import { useTranslation } from "@/foundation/lib/i18n";

type SubQuota = {
  dimension_type: QuotaDimensionType;
  dimension_value: string;
  limit_tokens: number;
};

type FormValues = {
  level: QuotaLevel;
  workspace: string;
  period: QuotaPeriod;
  target: string;
  // Overall (dimension-agnostic) quota for the scope. Optional (empty string =
  // none): a policy can consist solely of per-dimension sub-quotas.
  base_limit: string;
  // Per-dimension sub-quotas — each an independent overlay row.
  subs: SubQuota[];
};

type QuotaFormProps = {
  // Current workspace from the page context; used as the default selection.
  // May be ALL_WORKSPACES, in which case the user must pick one.
  workspace: string;
  // Upserts the base quota + every sub-quota as independent overlay policies.
  onSubmit: (paramsList: SetQuotaParams[]) => Promise<void>;
  onClose?: () => void;
};

export const QuotaForm = ({ workspace, onSubmit, onClose }: QuotaFormProps) => {
  const { t } = useTranslation();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm<FormValues>({
    mode: "all",
    defaultValues: {
      level: "workspace",
      workspace: workspace && workspace !== ALL_WORKSPACES ? workspace : "",
      period: "monthly",
      target: "",
      base_limit: "",
      subs: [],
    },
  });
  const subsArray = useRefineFieldArray({ control: form.control, name: "subs" });

  const level = form.watch("level");
  const selectedWorkspace = form.watch("workspace");
  const subs = form.watch("subs");

  // Reset target + sub-quotas when the scope (level or workspace) actually
  // changes — members/keys and endpoint names are scope-specific. Ref-guarded so
  // unrelated re-renders (e.g. picking a value) do not clear them.
  const prevScope = useRef(`${level}|${selectedWorkspace}`);
  useEffect(() => {
    const scope = `${level}|${selectedWorkspace}`;
    if (prevScope.current !== scope) {
      prevScope.current = scope;
      form.setValue("target", "");
      subsArray.replace([]);
    }
  }, [level, selectedWorkspace, form, subsArray.replace]);

  const { data: workspacesData } = useList<QuotaWorkspaceLite>({
    resource: "workspaces",
    pagination: { mode: "off" },
  });
  const { data: usersData } = useList<QuotaUserLite>({
    resource: "user_profiles",
    pagination: { mode: "off" },
    queryOptions: { enabled: level === "user" },
  });
  const { data: keysData } = useList<QuotaApiKeyLite>({
    resource: "api_keys",
    pagination: { mode: "off" },
    meta: { workspace: selectedWorkspace },
    queryOptions: { enabled: level === "api_key" && !!selectedWorkspace },
  });
  // Both endpoint kinds fetched once for the scope's workspace; the right list
  // is chosen per sub-quota row from its dimension type.
  const { data: endpointsData } = useList<QuotaNamedLite>({
    resource: "endpoints",
    pagination: { mode: "off" },
    meta: { workspace: selectedWorkspace },
    queryOptions: { enabled: !!selectedWorkspace },
  });
  const { data: extEndpointsData } = useList<QuotaNamedLite>({
    resource: "external_endpoints",
    pagination: { mode: "off" },
    meta: { workspace: selectedWorkspace },
    queryOptions: { enabled: !!selectedWorkspace },
  });

  const toNameOptions = (data?: { data?: QuotaNamedLite[] }) =>
    (data?.data ?? [])
      .map((d) => d.metadata?.name)
      .filter((n): n is string => !!n)
      .map((n) => ({ label: n, value: n }));

  const workspaceOptions = useMemo(
    () => toNameOptions(workspacesData),
    [workspacesData],
  );
  const userOptions = useMemo(
    () =>
      (usersData?.data ?? []).map((u) => ({
        label: u.spec?.email || u.metadata?.name || u.id,
        value: u.id,
      })),
    [usersData],
  );
  const keyOptions = useMemo(
    () =>
      (keysData?.data ?? []).map((k) => ({
        label: k.metadata?.name || k.id,
        value: k.id,
      })),
    [keysData],
  );
  const endpointOptions = useMemo(
    () => toNameOptions(endpointsData),
    [endpointsData],
  );
  const extEndpointOptions = useMemo(
    () => toNameOptions(extEndpointsData),
    [extEndpointsData],
  );

  const dimValueOptions = (dt: QuotaDimensionType | undefined) =>
    dt === "endpoint"
      ? endpointOptions
      : dt === "external_endpoint"
        ? extEndpointOptions
        : [];

  const scopeParams = (): Pick<
    SetQuotaParams,
    "p_level" | "p_period" | "p_workspace" | "p_user_id" | "p_api_key_id"
  > => {
    const v = form.getValues();
    if (v.level === "workspace") {
      return { p_level: "workspace", p_period: v.period, p_workspace: v.workspace };
    }
    if (v.level === "user") {
      return {
        p_level: "user",
        p_period: v.period,
        p_workspace: v.workspace,
        p_user_id: v.target,
      };
    }
    return { p_level: "api_key", p_period: v.period, p_api_key_id: v.target };
  };

  const submit = async (values: FieldValues) => {
    setSubmitError(null);
    const base = scopeParams();
    const list: SetQuotaParams[] = [];
    const baseLimit = String(values.base_limit ?? "").trim();
    if (baseLimit !== "") {
      list.push({ ...base, p_limit_tokens: Number(baseLimit) });
    }
    for (const sub of (values.subs ?? []) as SubQuota[]) {
      if (!sub.dimension_type || !sub.dimension_value) continue;
      list.push({
        ...base,
        p_limit_tokens: Number(sub.limit_tokens),
        p_dimension_type: sub.dimension_type,
        p_dimension_value: sub.dimension_value,
      });
    }
    if (list.length === 0) {
      setSubmitError(t("quota.messages.needOneQuota"));
      return;
    }
    try {
      await onSubmit(list);
      onClose?.();
    } catch (err) {
      const anyErr = err as {
        message?: string;
        response?: { data?: { message?: string } };
      };
      setSubmitError(
        anyErr?.response?.data?.message || anyErr?.message || String(err),
      );
    }
  };

  const workspaceField = (
    <FormFieldGroup
      {...form}
      name="workspace"
      label={t("common.fields.workspace")}
      rules={{ required: true }}
    >
      <FormCombobox
        placeholder={t("quota.placeholders.selectWorkspace")}
        options={workspaceOptions}
      />
    </FormFieldGroup>
  );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="space-y-3">
        <FormFieldGroup {...form} name="level" label={t("quota.fields.level")}>
          <FormCombobox
            options={QUOTA_LEVELS.map((l) => ({
              label: t(`quota.levels.${l}`),
              value: l,
            }))}
          />
        </FormFieldGroup>

        {level !== "api_key" && workspaceField}

        {level === "user" && (
          <FormFieldGroup
            {...form}
            name="target"
            label={t("quota.fields.user")}
            rules={{ required: true }}
          >
            <FormCombobox
              placeholder={t("quota.placeholders.selectUser")}
              options={userOptions}
            />
          </FormFieldGroup>
        )}

        {level === "api_key" && (
          <>
            {workspaceField}
            <FormFieldGroup
              {...form}
              name="target"
              label={t("quota.fields.apiKey")}
              rules={{ required: true }}
            >
              <FormCombobox
                placeholder={t("quota.placeholders.selectApiKey")}
                options={keyOptions}
              />
            </FormFieldGroup>
          </>
        )}

        <FormFieldGroup {...form} name="period" label={t("quota.fields.period")}>
          <FormCombobox
            options={QUOTA_PERIODS.map((p) => ({
              label: t(`quota.periods.${p}`),
              value: p,
            }))}
          />
        </FormFieldGroup>

        {/* Overall (dimension-agnostic) quota — optional; leave empty to set
            only per-dimension sub-quotas. */}
        <FormFieldGroup
          {...form}
          name="base_limit"
          label={t("quota.fields.overallLimit")}
          description={t("quota.fields.overallLimitHint")}
        >
          <Input type="number" min={0} placeholder={t("quota.dimensions.none")} />
        </FormFieldGroup>

        {/* Per-dimension sub-quotas. */}
        <div className="space-y-2 rounded-md border p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {t("quota.subQuotas.title")}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                subsArray.append({
                  dimension_type: "model",
                  dimension_value: "",
                  limit_tokens: 0,
                })
              }
            >
              <Plus className="mr-1 h-4 w-4" />
              {t("quota.subQuotas.add")}
            </Button>
          </div>

          {subsArray.fields.length === 0 && (
            <p className="text-xs text-muted-foreground">
              {t("quota.subQuotas.empty")}
            </p>
          )}

          {subsArray.fields.map((field, index) => {
            // Prefer the live watched value; fall back to the field's own value
            // (set at append time) before the array watch has propagated.
            const dt = (subs?.[index]?.dimension_type ??
              (field as unknown as SubQuota).dimension_type) as
              | QuotaDimensionType
              | undefined;
            return (
              <div
                key={field.id}
                className="flex items-end gap-2 border-t pt-2 first:border-t-0 first:pt-0"
              >
                <div className="flex-1">
                  <FormFieldGroup
                    {...form}
                    name={`subs.${index}.dimension_type`}
                    label={t("quota.fields.dimension")}
                  >
                    <FormCombobox
                      options={QUOTA_DIMENSION_TYPES.map((d) => ({
                        label: t(`quota.dimensions.${d}`),
                        value: d,
                      }))}
                    />
                  </FormFieldGroup>
                </div>
                <div className="flex-1">
                  {dt === "model" ? (
                    <FormFieldGroup
                      {...form}
                      name={`subs.${index}.dimension_value`}
                      label={t("quota.fields.modelName")}
                      rules={{ required: true }}
                    >
                      <Input placeholder={t("quota.placeholders.modelName")} />
                    </FormFieldGroup>
                  ) : (
                    <FormFieldGroup
                      {...form}
                      name={`subs.${index}.dimension_value`}
                      label={t("quota.fields.dimensionValue")}
                      rules={{ required: true }}
                    >
                      <FormCombobox
                        placeholder={t("quota.placeholders.selectDimensionValue")}
                        options={dimValueOptions(dt)}
                      />
                    </FormFieldGroup>
                  )}
                </div>
                <div className="w-28">
                  <FormFieldGroup
                    {...form}
                    name={`subs.${index}.limit_tokens`}
                    label={t("quota.fields.limitTokens")}
                    rules={{ required: true, min: 0 }}
                  >
                    <Input type="number" min={0} />
                  </FormFieldGroup>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="mb-1"
                  title={t("buttons.delete")}
                  onClick={() => subsArray.remove(index)}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            );
          })}
        </div>

        {submitError && (
          <Alert variant="destructive">
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose}>
            {t("buttons.cancel")}
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {t("buttons.save")}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
};
