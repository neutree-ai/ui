import FormCardGrid from "@/components/business/FormCardGrid";
import WorkspaceField from "@/components/business/WorkspaceField";
import { Combobox, Field, Select } from "@/components/theme";
import { Input } from "@/components/ui/input";
import { useLicense } from "@/hooks/use-license";
import { useTranslation } from "@/lib/i18n";
import type { Role, RoleAssignment, UserProfile } from "@/types";
import { useSelect } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";

export const useRoleAssignmentForm = ({
  action,
}: {
  action: "create" | "edit";
}) => {
  const { t } = useTranslation();
  const { supportMultiWorkspace } = useLicense();

  const form = useForm<RoleAssignment>({
    mode: "all",
    defaultValues: {
      api_version: "v1",
      kind: "RoleAssignment",
      metadata: {
        name: "",
      },
      spec: {
        user_id: "",
        workspace: "",
        global: !supportMultiWorkspace,
        role: "",
      },
    },
    refineCoreProps: {},
    warnWhenUnsavedChanges: true,
  });

  const isEdit = action === "edit";

  const global: RoleAssignment["spec"]["global"] = form.watch("spec.global");

  const users = useSelect<UserProfile>({
    resource: "user_profiles",
  });

  const roles = useSelect<Role>({
    resource: "roles",
  });

  return {
    form,
    metadataFields: (
      <FormCardGrid title={t("common.sections.basicInformation")}>
        <Field {...form} name="metadata.name" label={t("common.fields.name")}>
          <Input
            placeholder={t("role_assignments.placeholders.policyName")}
            disabled={isEdit}
          />
        </Field>
      </FormCardGrid>
    ),
    specFields: (
      <FormCardGrid title={t("role_assignments.fields.policy")}>
        <Field {...form} name="spec.user_id" label={t("common.fields.user")}>
          <Combobox
            placeholder={t("role_assignments.placeholders.selectUser")}
            disabled={users.query.isLoading}
            options={(users.query.data?.data || []).map((e) => ({
              label: e.metadata.name,
              value: e.id,
            }))}
          />
        </Field>
        <Field {...form} name="spec.role" label={t("common.fields.role")}>
          <Combobox
            placeholder={t("role_assignments.placeholders.selectRole")}
            disabled={roles.query.isLoading}
            options={(roles.query.data?.data || []).map((e) => ({
              label: e.metadata.name,
              value: e.metadata.name,
            }))}
          />
        </Field>
        <div className="col-span-2" />
        <Field
          {...form}
          name="spec.global"
          label={t("role_assignments.fields.policyScope")}
          description={t("role_assignments.descriptions.policyScope")}
        >
          <Select
            disabled={!supportMultiWorkspace}
            options={[
              { label: t("role_assignments.options.global"), value: true },
              { label: t("role_assignments.options.workspace"), value: false },
            ]}
            onChange={(_value) => {
              const value =
                typeof _value === "boolean" ? _value : _value === "true";
              form.setValue("spec.global", value);
              if (value) {
                form.setValue("spec.workspace", null);
              }
            }}
          />
        </Field>
        <Field
          {...form}
          name="spec.workspace"
          label={t("common.fields.workspace")}
          className={global ? "hidden" : ""}
        >
          <WorkspaceField />
        </Field>
      </FormCardGrid>
    ),
  };
};
