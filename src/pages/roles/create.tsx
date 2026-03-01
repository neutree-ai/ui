import { useRoleForm } from "@/domains/role/hooks/use-role-form";
import { ResourceForm } from "@/foundation/components/ResourceForm";

export const RolesCreate = () => {
  const { form, metadataFields, specFields } = useRoleForm({
    action: "create",
  });

  return (
    <ResourceForm {...form}>
      {metadataFields}
      {specFields}
    </ResourceForm>
  );
};
