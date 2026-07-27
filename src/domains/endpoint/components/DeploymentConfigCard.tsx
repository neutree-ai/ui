import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { ShowPage } from "@/foundation/components/ShowPage";
import type {
  DeploymentOptions,
  ReplicaSpec,
} from "@/foundation/types/serving-types";

interface DeploymentConfigCardProps {
  replicas: ReplicaSpec | null;
  deploymentOptions: DeploymentOptions | null;
  framed?: boolean;
  className?: string;
}

export default function DeploymentConfigCard({
  replicas,
  deploymentOptions,
  framed = true,
  className,
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

  const content = (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
      <ShowPage.Row title={t("common.fields.replica")}>
        {replicas?.num ?? 1}
      </ShowPage.Row>
      <ShowPage.Row title={t("common.fields.scheduler")}>
        {getSchedulerText()}
      </ShowPage.Row>
    </div>
  );

  if (!framed) {
    return (
      <div className={className}>
        <h3 className="mb-3 text-sm font-semibold text-foreground">
          {t("endpoints.sections.deploymentConfig")}
        </h3>
        {content}
      </div>
    );
  }

  return (
    <Card className={className ?? "mt-4"}>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
