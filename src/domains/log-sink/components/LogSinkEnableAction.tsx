import { useUpdate } from "@refinedev/core";
import { Power, PowerOff } from "lucide-react";
import { isLogSinkEnabled } from "@/domains/log-sink/lib/log-sink-form";
import type { LogSink } from "@/domains/log-sink/types";
import { RowAction, type RowActionProps } from "@/foundation/components/Table";
import { getErrorMessage } from "@/foundation/lib/error-message";
import { useTranslation } from "@/foundation/lib/i18n";

type Props = RowActionProps & { sink: LogSink };

/** Turns the sink on or off at once, like the API key enable/disable action. */
export const LogSinkEnableAction = ({ sink, disabled, ...props }: Props) => {
  const { t } = useTranslation();
  const { mutate, isLoading } = useUpdate<LogSink>();
  const isEnabled = isLogSinkEnabled(sink.spec);
  const verb = isEnabled ? "disable" : "enable";

  return (
    <RowAction
      {...props}
      icon={isEnabled ? <PowerOff size={16} /> : <Power size={16} />}
      title={t(`log_sinks.actions.${verb}`)}
      disabled={disabled || isLoading}
      onClick={() =>
        mutate({
          resource: "log_sinks",
          id: sink.metadata.name,
          // PATCH replaces spec whole; masked secrets are backfilled server-side.
          values: { spec: { ...sink.spec, enabled: !isEnabled } },
          mutationMode: "pessimistic",
          meta: { idColumnName: "metadata->name" },
          successNotification: () => ({
            type: "success",
            message: t(`log_sinks.messages.${verb}Success`),
          }),
          errorNotification: (error) => ({
            type: "error",
            message: getErrorMessage(
              error,
              t(`log_sinks.messages.${verb}Failed`),
            ),
          }),
        })
      }
    />
  );
};

LogSinkEnableAction.displayName = "LogSinkEnableAction";
