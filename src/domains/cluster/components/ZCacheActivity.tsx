import { useTranslation } from "react-i18next";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import Timestamp from "@/foundation/role/Timestamp";
import { cacheMessage, zcacheActivity } from "../lib/zcache-presentation";
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
  const serviceName = t("clusters.zcache.serviceName");
  const { details, operations } = zcacheActivity(summary, status);
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
          {details && (
            <details
              open={details.open}
              className="mb-4 rounded-md bg-muted/50 p-3 text-sm"
            >
              <summary className="cursor-pointer font-medium">
                {t("clusters.zcache.currentDetails")}
              </summary>
              <div className="mt-3 space-y-2 break-words">
                <p>{cacheMessage(details.errorMessage, serviceName)}</p>
                <p>{cacheMessage(details.observationError, serviceName)}</p>
                {details.change && (
                  <>
                    <p>{t(details.change.phaseKey)}</p>
                    <p>{cacheMessage(details.change.message, serviceName)}</p>
                    <p className="font-mono text-xs">
                      {details.change.operationId ||
                        t("clusters.zcache.notAccepted")}
                    </p>
                  </>
                )}
              </div>
            </details>
          )}
          {operations.map((op) => (
            <details key={op.id} className="border-b py-4">
              <summary className="cursor-pointer text-sm">
                <span className="ml-1 inline-flex w-[90%] flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{t(op.labelKey)}</span>
                  <span
                    className={
                      op.failed ? "text-destructive" : "text-muted-foreground"
                    }
                  >
                    {t(op.phaseKey)}
                  </span>
                </span>
                {op.createdAt && (
                  <span className="mt-1 block pl-4 text-xs text-muted-foreground">
                    <Timestamp timestamp={op.createdAt} />
                  </span>
                )}
              </summary>
              <div className="mt-3 space-y-3 pl-4 text-sm">
                {op.nodes.map((n) => (
                  <div key={n.name} className="break-words">
                    <p>
                      {n.name} · {t(n.phaseKey)}
                    </p>
                    {n.reason && (
                      <p className="text-muted-foreground">
                        {cacheMessage(n.reason, serviceName)}
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
                    {cacheMessage(op.message, serviceName)}
                  </p>
                </details>
              </div>
            </details>
          ))}
          {operations.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("clusters.zcache.noOperations")}
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
