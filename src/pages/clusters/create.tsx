import { useClusterForm } from "@/domains/cluster/hooks/use-cluster-form";
import { ResourceForm } from "@/foundation/components/ResourceForm";
import { useTranslation } from "@/foundation/lib/i18n";

export const ClustersCreate = () => {
  const { t } = useTranslation();
  const {
    form,
    metadataFields,
    imageRegistryFields,
    versionFields,
    typeFields,
    providerFields,
    routerFields,
    modelCacheFields,
    authFields,
  } = useClusterForm({ action: "create" });
  return (
    <ResourceForm {...form} title={t("clusters.create")}>
      {metadataFields}
      {imageRegistryFields}
      {typeFields}
      {versionFields}
      {providerFields}
      {routerFields}
      {authFields}
      {modelCacheFields}
    </ResourceForm>
  );
};
