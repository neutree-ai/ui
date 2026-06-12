import { useList } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";
import { useEffect, useMemo, useState } from "react";
import type { FieldValues } from "react-hook-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { ApiKey } from "@/domains/api-key/types";
import type { RoleAssignment } from "@/domains/role-assignment/types";
import type { UserProfile } from "@/domains/user/types";
import {
  QUOTA_LEVELS,
  QUOTA_PERIODS,
  type QuotaLevel,
  type QuotaPeriod,
} from "@/domains/quota/types";
import type { SetQuotaParams } from "@/domains/quota/hooks/use-quota";
import { FormCombobox } from "@/foundation/components/FormCombobox";
import { FormFieldGroup } from "@/foundation/components/FormFieldGroup";
import { useTranslation } from "@/foundation/lib/i18n";

type FormValues = {
  level: QuotaLevel;
  period: QuotaPeriod;
  target: string;
  limit_tokens: number;
};

type QuotaFormProps = {
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
      period: "monthly",
      target: "",
      limit_tokens: 0,
    },
  });

  const level = form.watch("level");

  // Reset the target selection whenever the level changes (a user id is not a
  // valid api-key id and vice versa).
  useEffect(() => {
    form.setValue("target", "");
  }, [level, form]);

  // Workspace members: role_assignments scoped to this workspace, joined to
  // user_profiles for a readable label.
  const { data: usersData } = useList<UserProfile>({
    resource: "user_profiles",
    pagination: { mode: "off" },
  });
  const { data: assignmentsData } = useList<RoleAssignment>({
    resource: "role_assignments",
    pagination: { mode: "off" },
    queryOptions: { enabled: level === "user" },
  });
  const { data: keysData } = useList<ApiKey>({
    resource: "api_keys",
    pagination: { mode: "off" },
    meta: { workspace },
    queryOptions: { enabled: level === "api_key" },
  });

  const userOptions = useMemo(() => {
    const emailById = new Map(
      (usersData?.data ?? []).map((u) => [u.id, u.spec?.email || u.metadata?.name || u.id]),
    );
    const memberIds = new Set(
      (assignmentsData?.data ?? [])
        .filter((a) => a.spec?.workspace === workspace)
        .map((a) => a.spec?.user_id),
    );
    return Array.from(memberIds)
      .filter(Boolean)
      .map((id) => ({ label: emailById.get(id as string) ?? (id as string), value: id as string }));
  }, [usersData, assignmentsData, workspace]);

  const keyOptions = useMemo(
    () =>
      (keysData?.data ?? []).map((k) => ({
        label: k.metadata?.name || k.id,
        value: k.id,
      })),
    [keysData],
  );

  const submit = async (values: FieldValues) => {
    setSubmitError(null);
    const params: SetQuotaParams = {
      p_level: values.level,
      p_period: values.period,
      p_limit_tokens: Number(values.limit_tokens),
    };
    if (values.level === "workspace") {
      params.p_workspace = workspace;
    } else if (values.level === "user") {
      params.p_workspace = workspace;
      params.p_user_id = values.target;
    } else {
      params.p_api_key_id = values.target;
    }
    try {
      await onSubmit(params);
      onClose?.();
    } catch (err) {
      // Surface hierarchy-violation messages (e.g. "User quota total exceeds
      // workspace quota") instead of silently closing.
      const anyErr = err as { message?: string; response?: { data?: { message?: string } } };
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
