import { useClusterForm } from "@/domains/cluster/hooks/use-cluster-form";
import { FormSectionStack } from "@/foundation/components/FormSectionStack";
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
    cacheFields,
    acceleratorVirtualizationFields,
    modelCacheFields,
    authFields,
  } = useClusterForm({ action: "create" });
  return (
    <ResourceForm {...form} title={t("clusters.create")}>
      <FormSectionStack>
        {metadataFields}
        {clusterConfigurationFields}
        {providerFields}
        {authFields}
        {routerFields}
        {cacheFields}
        {acceleratorVirtualizationFields}
        {modelCacheFields}
      </FormSectionStack>
    </ResourceForm>
  );
};
