import { useClusterForm } from "@/domains/cluster/hooks/use-cluster-form";
import { ResourceForm } from "@/foundation/components/ResourceForm";
import { useTranslation } from "@/foundation/lib/i18n";

export const ClustersCreate = () => {
  const { t } = useTranslation();
  const {
    form,
    metadataFields,
    clusterConfigurationFields,
    providerFields,
    routerFields,
    acceleratorVirtualizationFields,
    modelCacheFields,
    authFields,
  } = useClusterForm({ action: "create" });
  return (
    <ResourceForm {...form} title={t("clusters.create")}>
      <div className="overflow-hidden rounded-lg border bg-card">
        {metadataFields}
        {clusterConfigurationFields}
        {providerFields}
        {authFields}
        {routerFields}
        {acceleratorVirtualizationFields}
        {modelCacheFields}
      </div>
    </ResourceForm>
  );
};
