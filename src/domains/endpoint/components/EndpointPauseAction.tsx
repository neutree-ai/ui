import { useInvalidate, useUpdate } from "@refinedev/core";
import { PauseCircle, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import {
  computeTogglePayload,
  derivePauseState,
} from "@/domains/endpoint/lib/pause-action";
import type { Endpoint } from "@/domains/endpoint/types";
import { RowAction, type RowActionProps } from "@/foundation/components/Table";
import { useTranslation } from "@/foundation/lib/i18n";

type EndpointPauseActionProps = RowActionProps & {
  endpoint: Endpoint;
  resource?: string;
};

export const EndpointPauseAction = ({
  endpoint,
  resource = "endpoints",
  title,
  disabled,
  icon,
  ...props
}: EndpointPauseActionProps) => {
  const { t: translate } = useTranslation();
  const invalidate = useInvalidate();
  const { mutateAsync, isLoading } = useUpdate<Endpoint>();

  const { isPaused } = derivePauseState(endpoint);

  const handleToggle = async () => {
    if (isLoading) return;

    const { nextReplicaCount, nextLabels } = computeTogglePayload(endpoint);

    try {
      await mutateAsync({
        resource,
        id: endpoint.metadata.name,
        values: {
          ...endpoint,
          metadata: {
            ...endpoint.metadata,
            labels: nextLabels,
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
