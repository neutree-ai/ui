import { useForm } from "@refinedev/react-hook-form";
import { Combobox, Field, Select } from "@/components/theme";
import type { Role, RoleAssignment, UserProfile } from "@/types";
import FormCardGrid from "@/components/business/FormCardGrid";
import { Input } from "@/components/ui/input";
import WorkspaceField from "@/components/business/WorkspaceField";
import { useSelect } from "@refinedev/core";

export const useRoleAssignmentForm = ({
  action,
}: {
  action: "create" | "edit";
}) => {
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
        global: false,
        role: "",
      },
    },
    refineCoreProps: {
      autoSave: {
        enabled: true,
      },
    },
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
      <FormCardGrid title="Basic Information">
        <Field {...form} name="metadata.name" label="Name">
          <Input placeholder="Workspace Policy Name" disabled={isEdit} />
        </Field>
      </FormCardGrid>
    ),
    specFields: (
      <FormCardGrid title="Policy">
        <Field {...form} name="spec.user_id" label="User">
          <Combobox
            placeholder="Select A User"
            disabled={users.query.isLoading}
            options={(users.query.data?.data || []).map((e) => ({
              label: e.metadata.name,
              value: e.id,
            }))}
          />
        </Field>
        <Field {...form} name="spec.role" label="Role">
          <Combobox
            placeholder="Select A Role"
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
          label="Policy Scope"
          description="Global policies apply to all workspaces. Workspace policies only apply to the selected workspace."
        >
          <Select
            options={[
              { label: "Global", value: true },
              { label: "Workspace", value: false },
            ]}
            onChange={(_value) => {
              const value =
                typeof _value === "boolean" ? _value : _value === "true";
              form.setValue("spec.global", value);
              form.setValue("spec.workspace", value ? null : "");
            }}
          />
        </Field>
        {!global && (
          <Field {...form} name="spec.workspace" label="Workspace">
            <WorkspaceField />
          </Field>
        )}
      </FormCardGrid>
    ),
  };
};
