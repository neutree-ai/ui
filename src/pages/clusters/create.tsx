import { Form } from "@/components/theme";
import { useTranslation } from "@/lib/i18n";
import { useClusterForm } from "./use-cluster-form";

export const ClustersCreate = () => {
  const { t } = useTranslation();
  const {
    form,
    metadataFields,
    imageRegistryFields,
    typeFields,
    providerFields,
    routerFields,
    modelCacheFields,
    authFields,
  } = useClusterForm({ action: "create" });
  return (
    <Form {...form} title={t("clusters.create")}>
      {metadataFields}
      {imageRegistryFields}
      {typeFields}
      {providerFields}
      {routerFields}
      {authFields}
      {modelCacheFields}
    </Form>
  );
};
