import { Card, CardContent } from "@/components/ui/card";
import { ShowPage } from "@/foundation/components/ShowPage";
import type {
  DeploymentOptions,
  ReplicaSpec,
} from "@/foundation/types/serving-types";
import { useTranslation } from "react-i18next";

interface DeploymentConfigCardProps {
  replicas: ReplicaSpec | null;
  deploymentOptions: DeploymentOptions | null;
}

export default function DeploymentConfigCard({
  replicas,
  deploymentOptions,
}: DeploymentConfigCardProps) {
  const { t } = useTranslation();

  const getSchedulerText = () => {
    const schedulerType = deploymentOptions?.scheduler?.type;
    switch (schedulerType) {
      case "consistent_hash":
        return t("models.scheduler.consistentHashing");
      case "roundrobin":
        return t("models.scheduler.roundRobin");
      default:
        return t("models.scheduler.unavailable");
    }
  };

  return (
    <Card className="mt-4">
      <CardContent>
        <div className="grid grid-cols-4 gap-8">
          <ShowPage.Row title={t("common.fields.replica")}>
            {replicas?.num ?? 1}
          </ShowPage.Row>
          <ShowPage.Row title={t("common.fields.scheduler")}>
            {getSchedulerText()}
          </ShowPage.Row>
        </div>
      </CardContent>
    </Card>
  );
}
