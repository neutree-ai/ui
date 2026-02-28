import { NeutreeForm } from "@/foundation/components/NeutreeForm";
import { useTranslation } from "@/foundation/lib/i18n";
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
