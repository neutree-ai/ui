import { Form } from "@/components/theme";
import { useClusterForm } from "./use-cluster-form";
import { useTranslation } from "@/lib/i18n";

export const ClustersCreate = () => {
  const { t } = useTranslation();
  const {
    form,
    metadataFields,
    imageRegistryFields,
    typeFields,
    providerFields,
    headNodeFields,
    workerNodeFields,
    authFields,
  } = useClusterForm({ action: "create" });
  return (
    <Form {...form} title={t("clusters.create")}>
      {metadataFields}
      {imageRegistryFields}
      {typeFields}
      {providerFields}
      {headNodeFields}
      {workerNodeFields}
      {authFields}
    </Form>
  );
};
