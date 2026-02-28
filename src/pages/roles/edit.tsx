import { NeutreeForm } from "@/foundation/components/NeutreeForm";
import { useRoleForm } from "./use-role-form";

export const RolesEdit = () => {
  const { form, metadataFields, specFields } = useRoleForm({
    action: "edit",
  });

  return (
    <NeutreeForm {...form}>
      {metadataFields}
      {specFields}
    </NeutreeForm>
  );
};
