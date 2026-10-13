import { isSyncRequestPending } from "@/domains/identity-source/lib/identity-source-sync";
import type { IdentitySource } from "@/domains/identity-source/types";
import Timestamp from "@/foundation/components/Timestamp";
import { useTranslation } from "@/foundation/lib/i18n";
import { cn } from "@/foundation/lib/utils";

const pillClassNames = {
  ok: "border border-[var(--nt-stroke-positive-light)] bg-[var(--nt-fill-positive-light)] text-[var(--nt-text-colorful-positive)]",
  failed:
    "border border-[var(--nt-stroke-serious-light)] bg-[var(--nt-fill-serious-light)] text-[var(--nt-text-colorful-serious)]",
  pending:
    "border border-[var(--nt-stroke-notice-light)] bg-[var(--nt-fill-notice-light)] text-[var(--nt-text-colorful-notice)]",
};

type SyncResult = keyof typeof pillClassNames;

/** The state of the latest sync: requested and not reported yet, or its outcome. */
export const syncResultOf = (record: IdentitySource): SyncResult | null => {
  if (isSyncRequestPending(record)) return "pending";
  const last = record.status?.last_sync;
  if (!last?.finished_at) return null;
  return last.ok ? "ok" : "failed";
};

export function SyncResultPill({ result }: { result: SyncResult }) {
  const { t } = useTranslation();
  return (
    <span
      data-testid="identity-source-sync-result"
      className={cn(
        "inline-flex whitespace-nowrap rounded-lg px-2 py-0.5 text-xs font-semibold",
        pillClassNames[result],
      )}
    >
      {t(`identity_sources.syncResults.${result}`)}
    </span>
  );
}

/** List cell: the latest sync's outcome and when it finished. */
export function IdentitySourceLastSync({ record }: { record: IdentitySource }) {
  const result = syncResultOf(record);
  if (!result) {
    return <span data-testid="identity-source-sync-result">-</span>;
  }
  const finishedAt = record.status?.last_sync?.finished_at;
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <SyncResultPill result={result} />
      {result !== "pending" && finishedAt && (
        <Timestamp timestamp={finishedAt} relative />
      )}
    </span>
  );
}
