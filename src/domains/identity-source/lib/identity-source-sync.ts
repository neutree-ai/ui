import type { IdentitySource } from "@/domains/identity-source/types";
import { DEFAULT_SYNC_INTERVAL_SECONDS } from "./identity-source-values";

/** Only LDAP sources sync; the server refuses a request otherwise (10264). */
export const isSyncEnabled = (record: IdentitySource): boolean =>
  record.spec?.type === "ldap" && record.spec.sync?.enabled === true;

const time = (value?: string | null): number =>
  value ? Date.parse(value) : Number.NaN;

/**
 * Whether a sync was asked for and has not reported back yet. neutree-core
 * writes status.last_sync only when a sync finishes, recording the request it
 * handled, so a request later than that one is still queued or running.
 */
export const isSyncRequestPending = (record: IdentitySource): boolean => {
  const requested = time(record.spec?.sync?.requested_at);
  if (Number.isNaN(requested) || !isSyncEnabled(record)) return false;
  const handled = time(record.status?.last_sync?.requested_at);
  return Number.isNaN(handled) || requested > handled;
};

/** The i18n key and count that state a sync interval in its largest whole unit. */
export const syncIntervalLabel = (
  seconds?: number | null,
): { key: string; count: number } => {
  const value =
    seconds && seconds > 0 ? seconds : DEFAULT_SYNC_INTERVAL_SECONDS;
  if (value % 3600 === 0) {
    return { key: "identity_sources.values.everyHours", count: value / 3600 };
  }
  if (value % 60 === 0) {
    return { key: "identity_sources.values.everyMinutes", count: value / 60 };
  }
  return { key: "identity_sources.values.everySeconds", count: value };
};
