import { Input } from "@/components/ui/input";
import type { RoleAssignment } from "@/domains/role-assignment/types";
import type { Role } from "@/domains/role/types";
import type { UserProfile } from "@/domains/user/types";
import FormCardGrid from "@/foundation/components/FormCardGrid";
import { FormCombobox } from "@/foundation/components/FormCombobox";
import { FormFieldGroup } from "@/foundation/components/FormFieldGroup";
import { FormSelect } from "@/foundation/components/FormSelect";
import WorkspaceField from "@/foundation/components/WorkspaceField";
import { useLicense } from "@/foundation/hooks/use-license";
import { useTranslation } from "@/foundation/lib/i18n";
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
        <FormFieldGroup
          {...form}
          name="metadata.name"
          label={t("common.fields.name")}
        >
          <Input
            placeholder={t("role_assignments.placeholders.policyName")}
            disabled={isEdit}
          />
        </FormFieldGroup>
      </FormCardGrid>
    ),
    specFields: (
      <FormCardGrid title={t("role_assignments.fields.policy")}>
        <FormFieldGroup
          {...form}
          name="spec.user_id"
          label={t("common.fields.user")}
        >
          <FormCombobox
            placeholder={t("role_assignments.placeholders.selectUser")}
            disabled={users.query.isLoading}
            options={(users.query.data?.data || []).map((e) => ({
              label: e.metadata.name,
              value: e.id,
            }))}
          />
        </FormFieldGroup>
        <FormFieldGroup
          {...form}
          name="spec.role"
          label={t("common.fields.role")}
        >
          <FormCombobox
            placeholder={t("role_assignments.placeholders.selectRole")}
            disabled={roles.query.isLoading}
            options={(roles.query.data?.data || []).map((e) => ({
              label: e.metadata.name,
              value: e.metadata.name,
            }))}
          />
        </FormFieldGroup>
        <div className="col-span-2" />
        <FormFieldGroup
          {...form}
          name="spec.global"
          label={t("role_assignments.fields.policyScope")}
          description={t("role_assignments.descriptions.policyScope")}
        >
          <FormSelect
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
        </FormFieldGroup>
        <FormFieldGroup
          {...form}
          name="spec.workspace"
          label={t("common.fields.workspace")}
          className={global ? "hidden" : ""}
        >
          <WorkspaceField />
        </FormFieldGroup>
      </FormCardGrid>
    ),
  };
};
