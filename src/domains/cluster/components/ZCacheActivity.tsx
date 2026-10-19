import { useTranslation } from "react-i18next";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import Timestamp from "@/foundation/components/Timestamp";
import {
  cacheMessage,
  operationLabel,
  operationPhase,
} from "../lib/zcache-presentation";
import type { ClusterCacheStatus, ZCacheStatus } from "../types";
export function ZCacheActivity({
  status,
  summary,
  open,
  onOpenChange,
}: {
  status?: ZCacheStatus;
  summary?: ClusterCacheStatus;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const phase = summary?.phase;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        aria-describedby={undefined}
        overlayClassName="bg-black/20"
        className="flex w-full flex-col sm:max-w-xl"
      >
        <SheetHeader className="text-left">
          <SheetTitle>{t("clusters.zcache.operations")}</SheetTitle>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {(summary?.error_message ||
            status?.observation_error ||
            status?.change) && (
            <details
              open={phase === "Failed" || !!status?.observation_error}
              className="mb-4 rounded-md bg-muted/50 p-3 text-sm"
            >
              <summary className="cursor-pointer font-medium">
                {t("clusters.zcache.currentDetails")}
              </summary>
              <div className="mt-3 space-y-2 break-words">
                <p>
                  {cacheMessage(
                    summary?.error_message,
                    t("clusters.zcache.serviceName"),
                  )}
                </p>
                <p>
                  {cacheMessage(
                    status?.observation_error,
                    t("clusters.zcache.serviceName"),
                  )}
                </p>
                {status?.change && (
                  <>
                    <p>{t(operationPhase(status.change.phase))}</p>
                    <p>
                      {cacheMessage(
                        status.change.message,
                        t("clusters.zcache.serviceName"),
                      )}
                    </p>
                    <p className="font-mono text-xs">
                      {status.change.operation_id ||
                        t("clusters.zcache.notAccepted")}
                    </p>
                  </>
                )}
              </div>
            </details>
          )}
          {(status?.operations ?? []).map((op) => (
            <details key={op.id} className="border-b py-4">
              <summary className="cursor-pointer text-sm">
                <span className="ml-1 inline-flex w-[90%] flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {t(operationLabel(op.kind))}
                  </span>
                  <span
                    className={
                      op.phase === "Failed"
                        ? "text-destructive"
                        : "text-muted-foreground"
                    }
                  >
                    {t(operationPhase(op.phase))}
                  </span>
                </span>
                {op.created_at && (
                  <span className="mt-1 block pl-4 text-xs text-muted-foreground">
                    <Timestamp timestamp={op.created_at} />
                  </span>
                )}
              </summary>
              <div className="mt-3 space-y-3 pl-4 text-sm">
                {op.nodes?.map((n) => (
                  <div key={n.name} className="break-words">
                    <p>
                      {n.name} · {t(operationPhase(n.phase))}
                    </p>
                    {n.reason && (
                      <p className="text-muted-foreground">
                        {cacheMessage(
                          n.reason,
                          t("clusters.zcache.serviceName"),
                        )}
                      </p>
                    )}
                  </div>
                ))}
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer">
                    {t("clusters.zcache.diagnostics")}
                  </summary>
                  <p className="mt-2 break-all font-mono">{op.id}</p>
                  <p className="mt-1 break-words">
                    {cacheMessage(op.message, t("clusters.zcache.serviceName"))}
                  </p>
                </details>
              </div>
            </details>
          ))}
          {!status?.operations?.length && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("clusters.zcache.noOperations")}
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
