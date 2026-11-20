import { isSyncRequestPending } from "@/domains/identity-source/lib/identity-source-sync";
import type { IdentitySource } from "@/domains/identity-source/types";
import { EmptyValue } from "@/foundation/components/EmptyValue";
import Timestamp from "@/foundation/components/Timestamp";
import { useTranslation } from "@/foundation/lib/i18n";
import { STATUS_TONE } from "@/foundation/lib/status-tone";
import { cn } from "@/foundation/lib/utils";

const pillClassNames = {
  ok: STATUS_TONE.positive,
  failed: STATUS_TONE.serious,
  pending: STATUS_TONE.notice,
};

type SyncResult = keyof typeof pillClassNames;

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

export function IdentitySourceLastSync({ record }: { record: IdentitySource }) {
  const result = syncResultOf(record);
  if (!result) {
    return (
      <span data-testid="identity-source-sync-result">
        <EmptyValue />
      </span>
    );
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
