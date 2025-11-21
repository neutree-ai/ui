import FormCardGrid from "@/components/business/FormCardGrid";
import PermissionsTreeField from "@/components/business/PermissionsTreeField";
import { Field } from "@/components/theme";
import { Input } from "@/components/ui/input";
import type { Role } from "@/types";
import { useTranslation } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";

export const useRoleForm = ({ action }: { action: "create" | "edit" }) => {
  const { translate } = useTranslation();
  const form = useForm<Role>({
    mode: "all",
    defaultValues: {
      api_version: "v1",
      kind: "Role",
      metadata: {
        name: "",
      },
      spec: {
        preset_key: null,
        permissions: [],
      },
    },
    refineCoreProps: {},
    warnWhenUnsavedChanges: true,
  });

  const isEdit = action === "edit";

  return {
    form,
    metadataFields: (
      <FormCardGrid title={translate("roles.fields.basicInformation")}>
        <Field
          {...form}
          name="metadata.name"
          label={translate("roles.fields.name")}
        >
          <Input
            placeholder={translate("roles.placeholders.roleName")}
            disabled={isEdit}
          />
        </Field>
      </FormCardGrid>
    ),
    specFields: (
      <FormCardGrid title={translate("roles.fields.permissions")}>
        <Field {...form} name="spec.permissions" className="col-span-4">
          <PermissionsTreeField />
        </Field>
      </FormCardGrid>
    ),
  };
};
