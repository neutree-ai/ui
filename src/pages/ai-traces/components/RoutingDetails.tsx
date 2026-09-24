import type {
  TraceRouting,
  TraceRoutingTarget,
} from "@/foundation/lib/api/ai-traces";
import { useTranslation } from "@/foundation/lib/i18n";

export function RoutingDetails({ routing }: { routing?: TraceRouting }) {
  const { t } = useTranslation();
  const target = (value: TraceRoutingTarget) => (
    <div className="space-y-1 break-words">
      <div className="font-medium">
        {value.upstream} / {value.upstream_model}
      </div>
      <div className="text-xs text-muted-foreground">
        {t("ai_traces.routing.priority")}: {value.priority}
        {" · "}
        {t("ai_traces.routing.weight")}: {value.weight}
        {" · "}
        {t("ai_traces.routing.capacity")}: {value.inflight ?? "—"}
        {" / "}
        {value.max_inflight_requests > 0
          ? value.max_inflight_requests
          : t("ai_traces.routing.unlimited")}
      </div>
    </div>
  );

  return (
    <section
      className="space-y-3 rounded-md border p-4 text-sm"
      aria-label={t("ai_traces.routing.title")}
    >
      <h3 className="font-semibold">{t("ai_traces.routing.title")}</h3>
      {!routing ? (
        <p className="text-muted-foreground">
          {t("ai_traces.routing.unrecorded")}
        </p>
      ) : (
        <>
          <div>
            <span className="font-medium">
              {t(`ai_traces.routing.results.${routing.result}`, {
                defaultValue: routing.result,
              })}
            </span>
            {routing.reason && (
              <span className="ml-2 text-muted-foreground">
                {t(`ai_traces.routing.reasons.${routing.reason}`, {
                  defaultValue: routing.reason,
                })}
              </span>
            )}
          </div>
          {routing.selected && target(routing.selected)}
          {!!routing.skipped?.length && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground">
                {t("ai_traces.routing.skipped")}
              </h4>
              <ol className="list-decimal space-y-3 pl-5">
                {routing.skipped.map((item) => (
                  <li key={`${item.upstream}/${item.upstream_model}`}>
                    {target(item)}
                    <p className="mt-1 text-xs">
                      {t(`ai_traces.routing.reasons.${item.reason}`, {
                        defaultValue: item.reason,
                      })}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {(routing.skipped_total ?? 0) > (routing.skipped?.length ?? 0) && (
            <p className="text-xs text-muted-foreground">
              {t("ai_traces.routing.truncated", {
                shown: routing.skipped?.length ?? 0,
                total: routing.skipped_total,
              })}
            </p>
          )}
          {routing.gateway_instance && (
            <p className="break-all text-xs text-muted-foreground">
              {t("ai_traces.routing.gatewayInstance")}:{" "}
              {routing.gateway_instance}
            </p>
          )}
          {(routing.selected || !!routing.skipped?.length) && (
            <p className="text-xs text-muted-foreground">
              {t("ai_traces.routing.capacityHint")}
            </p>
          )}
        </>
      )}
    </section>
  );
}
