import { NeutreeForm } from "@/components/business/NeutreeForm";
import { useTranslation } from "@/lib/i18n";
import { useClusterForm } from "./use-cluster-form";

export const ClustersEdit = () => {
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
  } = useClusterForm({ action: "edit" });
  return (
    <NeutreeForm {...form} title={t("clusters.edit")}>
      {metadataFields}
      {imageRegistryFields}
      {typeFields}
      {providerFields}
      {routerFields}
      {modelCacheFields}
      {authFields}
    </NeutreeForm>
  );
};
