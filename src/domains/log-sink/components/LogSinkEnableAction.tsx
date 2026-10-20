import { useInvalidate, useUpdate } from "@refinedev/core";
import { Power, PowerOff } from "lucide-react";
import { toast } from "sonner";
import type { LogSink } from "@/domains/log-sink/types";
import { RowAction, type RowActionProps } from "@/foundation/components/Table";
import { getErrorMessage } from "@/foundation/lib/error-message";
import { useTranslation } from "@/foundation/lib/i18n";

type Props = RowActionProps & { sink: LogSink };

// Applies at once, like the API key enable/disable action (data.md: spec.enabled).
export const LogSinkEnableAction = ({ sink, disabled, ...props }: Props) => {
  const { t } = useTranslation();
  const invalidate = useInvalidate();
  const { mutateAsync, isLoading } = useUpdate<LogSink>();
  // Stored true when omitted (data.md), so only an explicit false is disabled.
  const isEnabled = sink.spec?.enabled !== false;

  const handleToggle = async () => {
    if (isLoading) return;

    try {
      await mutateAsync({
        resource: "log_sinks",
        id: sink.metadata.name,
        // PATCH replaces spec whole; masked secrets are backfilled server-side.
        values: { spec: { ...sink.spec, enabled: !isEnabled } },
        mutationMode: "pessimistic",
        meta: { idColumnName: "metadata->name" },
        successNotification: false,
        errorNotification: false,
      });

      toast.success(
        t(
          isEnabled
            ? "log_sinks.messages.disableSuccess"
            : "log_sinks.messages.enableSuccess",
        ),
      );

      await invalidate({
        resource: "log_sinks",
        id: sink.metadata.name,
        invalidates: ["list", "detail"],
      });
    } catch (error) {
      toast.error(
        getErrorMessage(
          error,
          t(
            isEnabled
              ? "log_sinks.messages.disableFailed"
              : "log_sinks.messages.enableFailed",
          ),
        ),
      );
    }
  };

  return (
    <RowAction
      {...props}
      icon={isEnabled ? <PowerOff size={16} /> : <Power size={16} />}
      title={t(
        isEnabled ? "log_sinks.actions.disable" : "log_sinks.actions.enable",
      )}
      disabled={disabled || isLoading}
      onClick={() => void handleToggle()}
    />
  );
};

LogSinkEnableAction.displayName = "LogSinkEnableAction";
