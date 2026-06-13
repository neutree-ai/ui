import { useList } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FieldValues } from "react-hook-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { SetAccessParams } from "@/domains/access/hooks/use-access";
import {
  ACCESS_LEVELS,
  ACCESS_RULE_TYPES,
  ACCESS_WINDOWS,
  type AccessApiKeyLite,
  type AccessLevel,
  type AccessRuleType,
  type AccessUserLite,
  type AccessWindow,
  type AccessWorkspaceLite,
} from "@/domains/access/types";
import { FormCombobox } from "@/foundation/components/FormCombobox";
import { FormFieldGroup } from "@/foundation/components/FormFieldGroup";
import { ALL_WORKSPACES } from "@/foundation/hooks/use-workspace";
import { useTranslation } from "@/foundation/lib/i18n";

type FormValues = {
  level: AccessLevel;
  workspace: string;
  target: string;
  rule_type: AccessRuleType;
  // rate_limit fields
  window: AccessWindow;
  limit: string;
  // concurrency field
  max: string;
};

type AccessFormProps = {
  // Current workspace from the page context; used as the default selection.
  // May be ALL_WORKSPACES, in which case the user must pick one.
  workspace: string;
  onSubmit: (params: SetAccessParams) => Promise<void>;
  onClose?: () => void;
};

export const AccessForm = ({
  workspace,
  onSubmit,
  onClose,
}: AccessFormProps) => {
  const { t } = useTranslation();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm<FormValues>({
    mode: "all",
    defaultValues: {
      level: "workspace",
      workspace: workspace && workspace !== ALL_WORKSPACES ? workspace : "",
      target: "",
      rule_type: "rate_limit",
      window: "minute",
      limit: "",
      max: "",
    },
  });

  const level = form.watch("level");
  const selectedWorkspace = form.watch("workspace");
  const ruleType = form.watch("rule_type");

  // Reset target when the scope (level or workspace) actually changes — members
  // and keys are scope-specific. Ref-guarded so unrelated re-renders (e.g.
  // typing a limit) do not clear it.
  const prevScope = useRef(`${level}|${selectedWorkspace}`);
  useEffect(() => {
    const scope = `${level}|${selectedWorkspace}`;
    if (prevScope.current !== scope) {
      prevScope.current = scope;
      form.setValue("target", "");
    }
  }, [level, selectedWorkspace, form]);

  const { data: workspacesData } = useList<AccessWorkspaceLite>({
    resource: "workspaces",
    pagination: { mode: "off" },
  });
  const { data: usersData } = useList<AccessUserLite>({
    resource: "user_profiles",
    pagination: { mode: "off" },
    queryOptions: { enabled: level === "user" },
  });
  const { data: keysData } = useList<AccessApiKeyLite>({
    resource: "api_keys",
    pagination: { mode: "off" },
    meta: { workspace: selectedWorkspace },
    queryOptions: { enabled: level === "api_key" && !!selectedWorkspace },
  });

  const workspaceOptions = useMemo(
    () =>
      (workspacesData?.data ?? [])
        .map((d) => d.metadata?.name)
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

  const scopeParams = (): Pick<
    SetAccessParams,
    "p_level" | "p_workspace" | "p_user_id" | "p_api_key_id"
  > => {
    const v = form.getValues();
    if (v.level === "workspace") {
      return { p_level: "workspace", p_workspace: v.workspace };
    }
    if (v.level === "user") {
      return { p_level: "user", p_workspace: v.workspace, p_user_id: v.target };
    }
    return { p_level: "api_key", p_api_key_id: v.target };
  };

  const submit = async (values: FieldValues) => {
    setSubmitError(null);
    const base = scopeParams();
    let params: SetAccessParams;
    if (values.rule_type === "concurrency") {
      const max = String(values.max ?? "").trim();
      if (max === "" || Number(max) <= 0) {
        setSubmitError(t("access.messages.needValue"));
        return;
      }
      params = {
        ...base,
        p_rule_type: "concurrency",
        p_rule_spec: { max: Number(max) },
      };
    } else {
      const limit = String(values.limit ?? "").trim();
      if (limit === "" || Number(limit) <= 0) {
        setSubmitError(t("access.messages.needValue"));
        return;
      }
      params = {
        ...base,
        p_rule_type: "rate_limit",
        p_rule_spec: { limit: Number(limit), window: values.window },
      };
    }
    try {
      await onSubmit(params);
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
        placeholder={t("access.placeholders.selectWorkspace")}
        options={workspaceOptions}
      />
    </FormFieldGroup>
  );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="space-y-3">
        <FormFieldGroup {...form} name="level" label={t("access.fields.level")}>
          <FormCombobox
            options={ACCESS_LEVELS.map((l) => ({
              label: t(`access.levels.${l}`),
              value: l,
            }))}
          />
        </FormFieldGroup>

        {level !== "api_key" && workspaceField}

        {level === "user" && (
          <FormFieldGroup
            {...form}
            name="target"
            label={t("access.fields.user")}
            rules={{ required: true }}
          >
            <FormCombobox
              placeholder={t("access.placeholders.selectUser")}
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
              label={t("access.fields.apiKey")}
              rules={{ required: true }}
            >
              <FormCombobox
                placeholder={t("access.placeholders.selectApiKey")}
                options={keyOptions}
              />
            </FormFieldGroup>
          </>
        )}

        <FormFieldGroup
          {...form}
          name="rule_type"
          label={t("access.fields.ruleType")}
        >
          <FormCombobox
            options={ACCESS_RULE_TYPES.map((r) => ({
              label: t(`access.ruleTypes.${r}`),
              value: r,
            }))}
          />
        </FormFieldGroup>

        {ruleType === "rate_limit" ? (
          <div className="flex items-end gap-2">
            <div className="w-32">
              <FormFieldGroup
                {...form}
                name="limit"
                label={t("access.fields.limit")}
                rules={{ required: true, min: 1 }}
              >
                <Input type="number" min={1} />
              </FormFieldGroup>
            </div>
            <div className="flex-1">
              <FormFieldGroup
                {...form}
                name="window"
                label={t("access.fields.window")}
              >
                <FormCombobox
                  options={ACCESS_WINDOWS.map((w) => ({
                    label: t(`access.windows.${w}`),
                    value: w,
                  }))}
                />
              </FormFieldGroup>
            </div>
          </div>
        ) : (
          <FormFieldGroup
            {...form}
            name="max"
            label={t("access.fields.max")}
            rules={{ required: true, min: 1 }}
          >
            <Input type="number" min={1} />
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
