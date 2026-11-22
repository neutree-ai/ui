import { isSyncRequestPending } from "@/domains/identity-source/lib/identity-source-sync";
import type { IdentitySource } from "@/domains/identity-source/types";
import { useTranslation } from "@/foundation/lib/i18n";
import { cn } from "@/foundation/lib/utils";
import { STATUS_TONE } from "@/foundation/role/status-tone";
import Timestamp from "@/foundation/role/Timestamp";
import { EmptyValue } from "@/foundation/type/EmptyValue";

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
