import { useClusterForm } from "@/domains/cluster/hooks/use-cluster-form";
import { ResourceForm } from "@/foundation/components/ResourceForm";
import { useTranslation } from "@/foundation/lib/i18n";

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
    <ResourceForm {...form} title={t("clusters.edit")}>
      {metadataFields}
      {imageRegistryFields}
      {typeFields}
      {providerFields}
      {routerFields}
      {modelCacheFields}
      {authFields}
    </ResourceForm>
  );
};
