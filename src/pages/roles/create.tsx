import { NeutreeForm } from "@/foundation/components/NeutreeForm";
import { useRoleForm } from "./use-role-form";

export const RolesCreate = () => {
  const { form, metadataFields, specFields } = useRoleForm({
    action: "create",
  });

  return (
    <NeutreeForm {...form}>
      {metadataFields}
      {specFields}
    </NeutreeForm>
  );
};
