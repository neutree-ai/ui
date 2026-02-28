import type { Endpoint } from "@/domains/endpoint/types";
import { RowAction, type RowActionProps } from "@/foundation/components/Table";
import { useInvalidate, useTranslate, useUpdate } from "@refinedev/core";
import { PauseCircle, PlayCircle } from "lucide-react";
import { toast } from "sonner";

type EndpointPauseActionProps = RowActionProps & {
  endpoint: Endpoint;
  resource?: string;
};

const LAST_REPLICA_LABEL = "neutree.ai/last_replicas";

const parseReplicaCount = (value: unknown): number | undefined => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }
  return parsed;
};

export const EndpointPauseAction = ({
  endpoint,
  resource = "endpoints",
  title,
  disabled,
  icon,
  ...props
}: EndpointPauseActionProps) => {
  const translate = useTranslate();
  const invalidate = useInvalidate();
  const { mutateAsync, isLoading } = useUpdate<Endpoint>();

  const rawReplicaCount = endpoint.spec.replicas?.num;
  const replicaCount =
    typeof rawReplicaCount === "number" ? rawReplicaCount : 1;
  const labels = (endpoint.metadata.labels ?? {}) as Record<string, unknown>;
  const storedReplicaCount = parseReplicaCount(labels[LAST_REPLICA_LABEL]);
  const isPaused = replicaCount === 0;
  const resumeReplicaCount =
    storedReplicaCount ?? (replicaCount > 0 ? replicaCount : 1);

  const handleToggle = async () => {
    if (isLoading) return;

    const nextReplicaCount = isPaused
      ? resumeReplicaCount > 0
        ? resumeReplicaCount
        : 1
      : 0;

    const nextLabels = { ...labels };
    if (isPaused) {
      delete nextLabels[LAST_REPLICA_LABEL];
    } else {
      const previousReplicas =
        replicaCount > 0 ? replicaCount : (storedReplicaCount ?? 1);
      nextLabels[LAST_REPLICA_LABEL] = String(previousReplicas);
    }

    const metadataLabels =
      Object.keys(nextLabels).length > 0 ? nextLabels : null;

    try {
      await mutateAsync({
        resource,
        id: endpoint.metadata.name,
        values: {
          ...endpoint,
          metadata: {
            ...endpoint.metadata,
            labels: metadataLabels,
          },
          spec: {
            ...endpoint.spec,
            replicas: {
              ...(endpoint.spec.replicas ?? { num: nextReplicaCount }),
              num: nextReplicaCount,
            },
          },
        },
        mutationMode: "pessimistic",
        meta: {
          idColumnName: "metadata->name",
          workspace: endpoint.metadata.workspace,
          workspaced: true,
        },
        successNotification: false,
        errorNotification: false,
      });

      toast.success(
        translate(
          isPaused
            ? "endpoints.messages.resumeSuccess"
            : "endpoints.messages.pauseSuccess",
        ),
      );

      await invalidate({
        resource,
        id: endpoint.metadata.name,
        invalidates: ["list", "detail"],
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : translate(
              isPaused
                ? "endpoints.messages.resumeFailed"
                : "endpoints.messages.pauseFailed",
            ),
      );
    }
  };

  const handleClick = () => {
    void handleToggle();
  };

  const actionIcon =
    icon ?? (isPaused ? <PlayCircle size={16} /> : <PauseCircle size={16} />);

  return (
    <RowAction
      {...props}
      icon={actionIcon}
      title={
        title ??
        translate(
          isPaused ? "endpoints.actions.resume" : "endpoints.actions.pause",
        )
      }
      disabled={disabled || isLoading}
      onClick={handleClick}
    />
  );
};

EndpointPauseAction.displayName = "EndpointPauseAction";
