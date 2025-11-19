import type { Endpoint } from "@/types";
import { useInvalidate, useTranslate, useUpdate } from "@refinedev/core";
import { PauseCircle } from "lucide-react";
import { toast } from "sonner";
import type { RowActionProps } from "../theme/table/actions";
import { RowAction } from "../theme/table/actions";

type EndpointPauseActionProps = RowActionProps & {
  endpoint: Endpoint;
  resource?: string;
};

export const EndpointPauseAction = ({
  endpoint,
  resource = "endpoints",
  title,
  disabled,
  icon = <PauseCircle size={16} />,
  ...props
}: EndpointPauseActionProps) => {
  const translate = useTranslate();
  const invalidate = useInvalidate();
  const { mutateAsync, isLoading } = useUpdate<Endpoint>();

  const replicas = endpoint.spec.replicas;
  const isPaused = (replicas?.num ?? 0) === 0;

  const handlePause = async () => {
    if (isPaused || isLoading) return;

    try {
      await mutateAsync({
        resource,
        id: endpoint.metadata.name,
        values: {
          ...endpoint,
          spec: {
            ...endpoint.spec,
            replicas: {
              ...(endpoint.spec.replicas ?? { num: 0 }),
              num: 0,
            },
          },
        },
        meta: {
          idColumnName: "metadata->name",
          workspace: endpoint.metadata.workspace,
          workspaced: true,
        },
        successNotification: false,
        errorNotification: false,
      });

      toast.success(translate("endpoints.messages.pauseSuccess"));

      await invalidate({
        resource,
        id: endpoint.metadata.name,
        invalidates: ["list", "detail"],
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error?.message
          : translate("endpoints.messages.pauseFailed"),
      );
    }
  };

  const handleClick = () => {
    void handlePause();
  };

  return (
    <RowAction
      {...props}
      icon={icon}
      title={
        isPaused
          ? translate("endpoints.messages.alreadyPaused")
          : (title ?? translate("endpoints.actions.pause"))
      }
      disabled={disabled || isPaused || isLoading}
      onClick={handleClick}
    />
  );
};

EndpointPauseAction.displayName = "EndpointPauseAction";
