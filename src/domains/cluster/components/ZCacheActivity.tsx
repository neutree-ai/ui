import { useTranslation } from "react-i18next";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import Timestamp from "@/foundation/components/Timestamp";
import { operationLabel, operationPhase } from "../lib/zcache-presentation";
import type { ZCacheStatus } from "../types";
export function ZCacheActivity({
  status,
  open,
  onOpenChange,
}: {
  status?: ZCacheStatus;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const phase = status?.phase;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        overlayClassName="bg-black/20"
        className="flex w-full flex-col sm:max-w-xl"
      >
        <SheetHeader className="text-left">
          <SheetTitle>{t("clusters.zcache.operations")}</SheetTitle>
          <SheetDescription>
            {t("clusters.zcache.historyHint")}
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {(status?.message || status?.observation_error || status?.change) && (
            <details
              open={phase === "Failed" || !!status.observation_error}
              className="mb-4 rounded-md bg-muted/50 p-3 text-sm"
            >
              <summary className="cursor-pointer font-medium">
                {t("clusters.zcache.currentDetails")}
              </summary>
              <div className="mt-3 space-y-2 break-words">
                <p>{status.message}</p>
                <p>{status.observation_error}</p>
                {status.change && (
                  <>
                    <p>{t(operationPhase(status.change.phase))}</p>
                    <p>{status.change.message}</p>
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
                      <p className="text-muted-foreground">{n.reason}</p>
                    )}
                  </div>
                ))}
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer">
                    {t("clusters.zcache.diagnostics")}
                  </summary>
                  <p className="mt-2 break-all font-mono">{op.id}</p>
                  <p className="mt-1 break-words">{op.message}</p>
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
