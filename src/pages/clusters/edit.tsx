import { Form } from "@/components/theme";
import { useClusterForm } from "./use-cluster-form";

export const ClustersEdit = () => {
  const {
    form,
    metadataFields,
    imageRegistryFields,
    providerFields,
    authFields,
  } = useClusterForm({ action: "edit" });
  return (
    <Form {...form} title="Edit Cluster">
      {metadataFields}
      {imageRegistryFields}
      {providerFields}
      {authFields}
    </Form>
  );
};
