import { useIdentitySourceForm } from "@/domains/identity-source/hooks/use-identity-source-form";
import { ResourceForm } from "@/foundation/components/ResourceForm";

export const IdentitySourcesEdit = () => {
  const { form, metadataFields, specFields, adminNote } = useIdentitySourceForm(
    { action: "edit" },
  );
  return (
    <ResourceForm {...form}>
      {metadataFields}
      {specFields}
      {adminNote}
    </ResourceForm>
  );
};
