import { Input } from "@/components/ui/input";
import PermissionsTreeField from "@/domains/role/components/PermissionsTreeField";
import type { Role } from "@/domains/role/types";
import FormCardGrid from "@/foundation/components/FormCardGrid";
import { FormFieldGroup } from "@/foundation/components/FormFieldGroup";
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
      <FormCardGrid title={translate("common.sections.basicInformation")}>
        <FormFieldGroup
          {...form}
          name="metadata.name"
          label={translate("common.fields.name")}
        >
          <Input
            placeholder={translate("roles.placeholders.roleName")}
            disabled={isEdit}
          />
        </FormFieldGroup>
      </FormCardGrid>
    ),
    specFields: (
      <FormCardGrid title={translate("common.fields.permissions")}>
        <FormFieldGroup
          {...form}
          name="spec.permissions"
          className="col-span-4"
        >
          <PermissionsTreeField />
        </FormFieldGroup>
      </FormCardGrid>
    ),
  };
};
