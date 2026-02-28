import { ResourceForm } from "@/foundation/components/ResourceForm";
import { useRoleForm } from "./use-role-form";

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
