import { Form } from "@/components/theme";
import { useClusterForm } from "./use-cluster-form";
import { useTranslation } from "@/lib/i18n";

export const ClustersEdit = () => {
  const { t } = useTranslation();
  const {
    form,
    metadataFields,
    imageRegistryFields,
    typeFields,
    providerFields,
    headNodeFields,
    workerNodeFields,
    modelCacheFields,
    authFields,
  } = useClusterForm({ action: "edit" });
  return (
    <Form {...form} title={t("clusters.edit")}>
      {metadataFields}
      {imageRegistryFields}
      {typeFields}
      {providerFields}
      {headNodeFields}
      {workerNodeFields}
      {modelCacheFields}
      {authFields}
    </Form>
  );
};
