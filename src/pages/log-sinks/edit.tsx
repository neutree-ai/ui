import { useLogSinkForm } from "@/domains/log-sink/hooks/use-log-sink-form";
import { ResourceForm } from "@/foundation/components/ResourceForm";

export const LogSinksEdit = () => {
  const { form, metadataFields, specFields } = useLogSinkForm({
    action: "edit",
  });

  return (
    <ResourceForm {...form}>
      {metadataFields}
      {specFields}
    </ResourceForm>
  );
};
