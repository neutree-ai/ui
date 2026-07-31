import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div className="grid gap-x-10 gap-y-5 sm:grid-cols-[repeat(2,minmax(0,220px))]">
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
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle>{t("endpoints.sections.deploymentConfig")}</CardTitle>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
