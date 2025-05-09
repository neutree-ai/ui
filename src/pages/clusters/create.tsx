import { Form } from "@/components/theme";
import { useClusterForm } from "./use-cluster-form";

export const ClustersCreate = () => {
  const {
    form,
    metadataFields,
    imageRegistryFields,
    typeFields,
    providerFields,
    authFields,
  } = useClusterForm({ action: "create" });
  return (
    <Form {...form} title="Create Cluster">
      {metadataFields}
      {imageRegistryFields}
      {typeFields}
      {providerFields}
      {authFields}
    </Form>
  );
};
