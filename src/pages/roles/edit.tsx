import { ResourceForm } from "@/foundation/components/ResourceForm";
import { useRoleForm } from "./use-role-form";

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
