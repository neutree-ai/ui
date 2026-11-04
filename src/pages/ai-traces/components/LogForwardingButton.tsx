import { useList, useNavigation } from "@refinedev/core";
import { Forward } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { summarizeForwarding } from "@/domains/log-sink/lib/forwarding-summary";
import type { LogSink } from "@/domains/log-sink/types";
import { Link } from "@/foundation/components/Link";
import { useHasPermission } from "@/foundation/hooks/use-has-permission";
import { useTranslation } from "@/foundation/lib/i18n";
import { cn } from "@/foundation/lib/utils";

/** Entry to Log Forwarding: how many destinations are on, and whether any is unhealthy. */
export const LogForwardingButton = () => {
  const { t } = useTranslation();
  const { listUrl } = useNavigation();
  const canRead = useHasPermission("log_sink:read").allowed === true;

  const { data } = useList<LogSink>({
    resource: "log_sinks",
    pagination: { mode: "off" },
    // Phases change every 10–30s; a slower poll than the list pages is enough.
    queryOptions: { enabled: canRead, refetchInterval: 15_000 },
    errorNotification: false,
  });

  if (!canRead) return null;

  const summary = summarizeForwarding(data?.data ?? []);
  const hint =
    summary.alert === "failed"
      ? t("ai_traces.forwarding.failing", { count: summary.failed })
      : summary.alert === "degraded"
        ? t("ai_traces.forwarding.degraded", { count: summary.degraded })
        : t("ai_traces.forwarding.hint");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="outline" size="sm" asChild>
          <Link href={listUrl("log_sinks")} data-testid="log-forwarding-button">
            <Forward className="size-4" />
            {summary.enabled > 0
              ? t("ai_traces.forwarding.buttonWithCount", {
                  count: summary.enabled,
                })
              : t("ai_traces.forwarding.button")}
            {summary.alert && (
              <>
                <span
                  data-testid="log-forwarding-alert"
                  data-alert={summary.alert}
                  aria-hidden
                  className={cn(
                    "size-2 rounded-full",
                    summary.alert === "failed"
                      ? "bg-[var(--nt-fill-serious-base)]"
                      : "bg-[var(--nt-fill-notice-base)]",
                  )}
                />
                <span className="sr-only">{hint}</span>
              </>
            )}
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{hint}</TooltipContent>
    </Tooltip>
  );
};
