import type { LogSink } from "@/domains/log-sink/types";
import { isLogSinkEnabled } from "./log-sink-display";

type ForwardingSummary = {
  /** Destinations switched on. */
  enabled: number;
  failed: number;
  degraded: number;
  /** The worst problem: any Failed wins over any Degraded. */
  alert: "failed" | "degraded" | null;
};

export const summarizeForwarding = (sinks: LogSink[]): ForwardingSummary => {
  const live = sinks.filter((sink) => !sink.metadata?.deletion_timestamp);
  const enabled = live.filter((sink) => isLogSinkEnabled(sink.spec)).length;
  const failed = live.filter((sink) => sink.status?.phase === "Failed").length;
  const degraded = live.filter(
    (sink) => sink.status?.phase === "Degraded",
  ).length;

  return {
    enabled,
    failed,
    degraded,
    alert: failed > 0 ? "failed" : degraded > 0 ? "degraded" : null,
  };
};
