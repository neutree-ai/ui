import { useClusterForm } from "@/domains/cluster/hooks/use-cluster-form";
import { useTranslation } from "@/foundation/lib/i18n";
import { FormSectionStack } from "@/foundation/scene/FormSectionStack";
import { ResourceForm } from "@/foundation/scene/ResourceForm";

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
      <FormSectionStack>
        {metadataFields}
        {clusterConfigurationFields}
        {providerFields}
        {authFields}
        {routerFields}
        {acceleratorVirtualizationFields}
        {modelCacheFields}
      </FormSectionStack>
    </ResourceForm>
  );
};
