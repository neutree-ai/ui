import {
  isSyncEnabled,
  isSyncPaused,
  syncIntervalLabel,
} from "@/domains/identity-source/lib/identity-source-sync";
import type {
  IdentitySource,
  IdentitySourceSyncStatus,
} from "@/domains/identity-source/types";
import { ShowPage } from "@/foundation/components/ShowPage";
import Timestamp from "@/foundation/components/Timestamp";
import { useTranslation } from "@/foundation/lib/i18n";
import { IdentitySourceSyncNowButton } from "./IdentitySourceSyncNowButton";
import { SyncResultPill, syncResultOf } from "./IdentitySourceSyncResult";

const COUNTS = [
  "created",
  "updated",
  "reactivated",
  "deactivated",
  "memberships",
  "pending",
] as const satisfies readonly (keyof IdentitySourceSyncStatus)[];

const time = (value?: string | null) =>
  value ? <Timestamp timestamp={value} relative /> : "-";

/** Organization sync of an LDAP source: its schedule and the last outcome. */
export function IdentitySourceSyncSection({
  record,
}: {
  record: IdentitySource;
}) {
  const { t } = useTranslation();
  const enabled = isSyncEnabled(record);
  const paused = isSyncPaused(record);
  const last = record.status?.last_sync;
  const result = syncResultOf(record);
  const interval = syncIntervalLabel(record.spec.sync?.interval);

  return (
    <ShowPage.Section
      title={t("identity_sources.sections.orgSync")}
      actions={<IdentitySourceSyncNowButton record={record} />}
      data-testid="identity-source-sync-section"
    >
      {paused && (
        <p
          className="mb-5 text-sm text-muted-foreground"
          data-testid="identity-source-sync-paused"
        >
          {t("identity_sources.status.syncPaused")}
        </p>
      )}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-4">
        <ShowPage.Row title={t("identity_sources.fields.syncEnabled")}>
          {t(
            enabled
              ? "identity_sources.values.on"
              : paused
                ? "identity_sources.values.paused"
                : "identity_sources.values.off",
          )}
        </ShowPage.Row>
        <ShowPage.Row title={t("identity_sources.fields.syncSchedule")}>
          {enabled ? t(interval.key, { count: interval.count }) : "-"}
        </ShowPage.Row>
        <ShowPage.Row title={t("identity_sources.fields.lastSyncResult")}>
          {result ? <SyncResultPill result={result} /> : "-"}
        </ShowPage.Row>
        <ShowPage.Row title={t("identity_sources.fields.lastSuccess")}>
          {time(last?.last_success_time)}
        </ShowPage.Row>
      </div>
      {last?.started_at ? (
        <div
          className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-4"
          data-testid="identity-source-last-sync"
        >
          {/* The latest manual request, not the one the last sync handled:
          a scheduled sync carries over an old request time. */}
          <ShowPage.Row title={t("identity_sources.fields.syncRequestedAt")}>
            {time(record.spec.sync?.requested_at)}
          </ShowPage.Row>
          <ShowPage.Row title={t("identity_sources.fields.syncStartedAt")}>
            {time(last.started_at)}
          </ShowPage.Row>
          <ShowPage.Row title={t("identity_sources.fields.syncFinishedAt")}>
            {time(last.finished_at)}
          </ShowPage.Row>
          <div />
          <div className="grid grid-cols-3 gap-5 lg:col-span-4 lg:grid-cols-6">
            {COUNTS.map((key) => (
              <ShowPage.SummaryItem
                key={key}
                label={t(`identity_sources.syncCounts.${key}`)}
                value={
                  <span data-testid={`identity-source-sync-count-${key}`}>
                    {last[key] ?? 0}
                  </span>
                }
              />
            ))}
          </div>
          <div className="lg:col-span-4">
            <ShowPage.Row title={t("common.fields.message")}>
              <span className="whitespace-pre-wrap break-words">
                {last.message?.trim() || "-"}
              </span>
            </ShowPage.Row>
          </div>
        </div>
      ) : (
        <p
          className="mt-5 text-sm text-muted-foreground"
          data-testid="identity-source-sync-empty"
        >
          {t(
            result === "pending"
              ? "identity_sources.status.syncWaiting"
              : enabled || paused
                ? "identity_sources.status.notSynced"
                : "identity_sources.status.syncOff",
          )}
        </p>
      )}
    </ShowPage.Section>
  );
}
