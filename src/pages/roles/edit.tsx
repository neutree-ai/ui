import { useRoleForm } from "@/domains/role/hooks/use-role-form";
import { ResourceForm } from "@/foundation/components/ResourceForm";

export const RolesEdit = () => {
  const { form, metadataFields, specFields } = useRoleForm({
    action: "edit",
  });

  return (
    <ResourceForm {...form}>
      {metadataFields}
      {specFields}
    </ResourceForm>
  );
};
