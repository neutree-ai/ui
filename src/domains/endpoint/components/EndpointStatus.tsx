import type { EndpointReplicaStatus } from "@/domains/endpoint/types";
import BaseStatus from "@/foundation/components/BaseStatus";
import { useTranslation } from "@/foundation/lib/i18n";
import type { BaseStatus as BaseStatusType } from "@/foundation/types/basic-types";

type EndpointStatusProps = BaseStatusType & {
  replicas?: EndpointReplicaStatus[] | null;
};

const displayValue = (value?: string | null) => value || "-";

const getRoleLabel = (
  role: string | null | undefined,
  t: (key: string) => string,
) => {
  if (!role) return "-";
  const key = `endpoints.roles.${role}`;
  const translated = t(key);
  return translated === key ? role : translated;
};

export function EndpointReplicaStatusList({
  replicas,
}: {
  replicas?: EndpointReplicaStatus[] | null;
}) {
  const { t } = useTranslation();
  const replicaRows = replicas ?? [];
  const showRole = replicaRows.some((replica) => Boolean(replica.role));

  if (!replicaRows.length) return null;

  return (
    <div className="min-w-[320px]">
      <div className="mb-2 font-semibold">
        {t("endpoints.status.replicaStatus")}
      </div>
      <div className="grid gap-1">
        <div
          className="grid gap-3 font-semibold"
          style={{
            gridTemplateColumns: showRole
              ? "1fr 2fr 1.5fr 1fr"
              : "2fr 1.5fr 1fr",
          }}
        >
          {showRole && <span>{t("common.fields.role")}</span>}
          <span>{t("common.fields.replica")}</span>
          <span>{t("endpoints.status.node")}</span>
          <span>{t("endpoints.status.phase")}</span>
        </div>
        {replicaRows.map((replica, index) => (
          <div
            className="grid gap-3"
            key={`${replica.id ?? "replica"}-${index}`}
            style={{
              gridTemplateColumns: showRole
                ? "1fr 2fr 1.5fr 1fr"
                : "2fr 1.5fr 1fr",
            }}
          >
            {showRole && <span>{getRoleLabel(replica.role, t)}</span>}
            <span className="break-all">{displayValue(replica.id)}</span>
            <span className="break-all">{displayValue(replica.node_name)}</span>
            <span>{displayValue(replica.phase)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function EndpointStatus(status: EndpointStatusProps) {
  const { t } = useTranslation();

  const classMapping = {
    Running: "bg-green-100 text-green-800",
    Failed: "bg-red-100 text-red-800",
    Pending: "bg-yellow-100 text-yellow-800",
    Deploying: "bg-blue-100 text-blue-800",
    Deleting: "bg-orange-100 text-orange-800",
    Paused: "bg-yellow-100 text-yellow-800",
    Deleted: "bg-gray-100 text-gray-800",
  }[status.phase ?? "-"];

  const translatedPhase = t(`status.phases.endpoint.${status.phase}`);

  return (
    <BaseStatus
      {...status}
      className={classMapping}
      translatedPhase={translatedPhase}
    >
      <EndpointReplicaStatusList replicas={status.replicas} />
    </BaseStatus>
  );
}
