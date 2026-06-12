import { useList } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";
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
  type QuotaLevel,
  type QuotaNamedLite,
  type QuotaPeriod,
  type QuotaUserLite,
  type QuotaWorkspaceLite,
} from "@/domains/quota/types";
import type { SetQuotaParams } from "@/domains/quota/hooks/use-quota";
import { FormCombobox } from "@/foundation/components/FormCombobox";
import { FormFieldGroup } from "@/foundation/components/FormFieldGroup";
import { ALL_WORKSPACES } from "@/foundation/hooks/use-workspace";
import { useTranslation } from "@/foundation/lib/i18n";

type FormValues = {
  level: QuotaLevel;
  workspace: string;
  period: QuotaPeriod;
  target: string;
  limit_tokens: number;
  // "" = no dimension (whole-scope quota); otherwise an overlay on a specific
  // endpoint / external_endpoint / model.
  dimension_type: "" | "endpoint" | "external_endpoint" | "model";
  dimension_value: string;
};

type QuotaFormProps = {
  // Current workspace from the page context; used as the default selection.
  // May be ALL_WORKSPACES, in which case the user must pick one.
  workspace: string;
  onSubmit: (params: SetQuotaParams) => Promise<void>;
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
      limit_tokens: 0,
      dimension_type: "",
      dimension_value: "",
    },
  });

  const level = form.watch("level");
  const selectedWorkspace = form.watch("workspace");
  const dimensionType = form.watch("dimension_type");

  // Reset the target selection only when the scope (level or workspace) actually
  // changes — a user id is not a valid api-key id, and members/keys are
  // workspace-specific. Guarded by a ref so unrelated re-renders (e.g. picking a
  // target, which is what previously wiped the selection) do not clear it.
  const prevScope = useRef(`${level}|${selectedWorkspace}`);
  useEffect(() => {
    const scope = `${level}|${selectedWorkspace}`;
    if (prevScope.current !== scope) {
      prevScope.current = scope;
      form.setValue("target", "");
    }
  }, [level, selectedWorkspace, form]);

  // Reset the dimension value when the dimension type changes (same ref-guard
  // pattern so picking a value does not wipe it).
  const prevDim = useRef(dimensionType);
  useEffect(() => {
    if (prevDim.current !== dimensionType) {
      prevDim.current = dimensionType;
      form.setValue("dimension_value", "");
    }
  }, [dimensionType, form]);

  const { data: workspacesData } = useList<QuotaWorkspaceLite>({
    resource: "workspaces",
    pagination: { mode: "off" },
  });
  // All user profiles the caller can see — a workspace admin sets a user-level
  // quota for any of them. (There is no per-workspace membership table to filter
  // on; the backend keys the policy by (workspace, user_id) and RLS authorizes.)
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
  const dimResource =
    dimensionType === "endpoint"
      ? "endpoints"
      : dimensionType === "external_endpoint"
        ? "external_endpoints"
        : null;
  const { data: dimData } = useList<QuotaNamedLite>({
    resource: dimResource ?? "endpoints",
    pagination: { mode: "off" },
    meta: { workspace: selectedWorkspace },
    queryOptions: { enabled: !!dimResource && !!selectedWorkspace },
  });

  const workspaceOptions = useMemo(
    () =>
      (workspacesData?.data ?? [])
        .map((w) => w.metadata?.name)
        .filter((n): n is string => !!n)
        .map((n) => ({ label: n, value: n })),
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

  const dimValueOptions = useMemo(
    () =>
      (dimData?.data ?? [])
        .map((d) => d.metadata?.name)
        .filter((n): n is string => !!n)
        .map((n) => ({ label: n, value: n })),
    [dimData],
  );

  const submit = async (values: FieldValues) => {
    setSubmitError(null);
    const params: SetQuotaParams = {
      p_level: values.level,
      p_period: values.period,
      p_limit_tokens: Number(values.limit_tokens),
    };
    if (values.level === "workspace") {
      params.p_workspace = values.workspace;
    } else if (values.level === "user") {
      params.p_workspace = values.workspace;
      params.p_user_id = values.target;
    } else {
      params.p_api_key_id = values.target;
    }
    if (values.dimension_type) {
      params.p_dimension_type = values.dimension_type;
      params.p_dimension_value = values.dimension_value;
    }
    try {
      await onSubmit(params);
      onClose?.();
    } catch (err) {
      // Surface hierarchy-violation messages (e.g. "User quota total exceeds
      // workspace quota") instead of silently closing.
      const anyErr = err as {
        message?: string;
        response?: { data?: { message?: string } };
      };
      setSubmitError(
        anyErr?.response?.data?.message || anyErr?.message || String(err),
      );
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="space-y-2">
        <FormFieldGroup {...form} name="level" label={t("quota.fields.level")}>
          <FormCombobox
            options={QUOTA_LEVELS.map((l) => ({
              label: t(`quota.levels.${l}`),
              value: l,
            }))}
          />
        </FormFieldGroup>

        {/* Workspace is always chosen explicitly: it is the target for the
            workspace level and the scope for user/api_key levels. */}
        {level !== "api_key" && (
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
        )}

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

        <FormFieldGroup
          {...form}
          name="limit_tokens"
          label={t("quota.fields.limitTokens")}
          rules={{ required: true, min: 0 }}
        >
          <Input type="number" min={0} />
        </FormFieldGroup>

        {/* Optional dimension overlay: restrict this quota to one
            endpoint / external_endpoint / model. */}
        <FormFieldGroup
          {...form}
          name="dimension_type"
          label={t("quota.fields.dimension")}
        >
          <FormCombobox
            placeholder={t("quota.dimensions.none")}
            options={[
              { label: t("quota.dimensions.none"), value: "" },
              ...QUOTA_DIMENSION_TYPES.map((d) => ({
                label: t(`quota.dimensions.${d}`),
                value: d,
              })),
            ]}
          />
        </FormFieldGroup>

        {(dimensionType === "endpoint" ||
          dimensionType === "external_endpoint") && (
          <FormFieldGroup
            {...form}
            name="dimension_value"
            label={t("quota.fields.dimensionValue")}
            rules={{ required: true }}
          >
            <FormCombobox
              placeholder={t("quota.placeholders.selectDimensionValue")}
              options={dimValueOptions}
            />
          </FormFieldGroup>
        )}

        {dimensionType === "model" && (
          <FormFieldGroup
            {...form}
            name="dimension_value"
            label={t("quota.fields.modelName")}
            rules={{ required: true }}
          >
            <Input placeholder={t("quota.placeholders.modelName")} />
          </FormFieldGroup>
        )}

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
