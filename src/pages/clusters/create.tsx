import { ResourceForm } from "@/foundation/components/ResourceForm";
import { useTranslation } from "@/foundation/lib/i18n";
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
    <ResourceForm {...form} title={t("clusters.create")}>
      {metadataFields}
      {imageRegistryFields}
      {typeFields}
      {providerFields}
      {routerFields}
      {authFields}
      {modelCacheFields}
    </ResourceForm>
  );
};
