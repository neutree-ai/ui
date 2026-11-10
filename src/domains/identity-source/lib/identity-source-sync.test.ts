import { describe, expect, it } from "vitest";
import type { IdentitySource } from "@/domains/identity-source/types";
import {
  isSyncEnabled,
  isSyncPaused,
  isSyncRequestPending,
  syncIntervalLabel,
} from "./identity-source-sync";

const source = (
  spec: Partial<IdentitySource["spec"]>,
  lastRequestedAt?: string,
): IdentitySource =>
  ({
    metadata: { name: "corp-ldap" },
    spec: { type: "ldap", enabled: true, ...spec },
    status: lastRequestedAt
      ? { last_sync: { ok: true, requested_at: lastRequestedAt } }
      : null,
  }) as IdentitySource;

describe("isSyncEnabled", () => {
  it("is true only for an LDAP source with sync on", () => {
    expect(isSyncEnabled(source({ sync: { enabled: true } }))).toBe(true);
    expect(isSyncEnabled(source({ sync: { enabled: false } }))).toBe(false);
    expect(isSyncEnabled(source({}))).toBe(false);
    expect(
      isSyncEnabled(source({ type: "oidc", sync: { enabled: true } })),
    ).toBe(false);
  });

  it("is paused, not enabled, while the source is disabled", () => {
    const disabled = source({ enabled: false, sync: { enabled: true } });
    expect(isSyncEnabled(disabled)).toBe(false);
    expect(isSyncPaused(disabled)).toBe(true);
    expect(isSyncPaused(source({ sync: { enabled: true } }))).toBe(false);
    expect(isSyncPaused(source({ enabled: false }))).toBe(false);
  });
});

describe("isSyncRequestPending", () => {
  const at = "2026-10-13T08:00:00.123456+00:00";
  const later = "2026-10-13T08:05:00+00:00";

  it("is pending until a sync reports the request as handled", () => {
    expect(
      isSyncRequestPending(
        source({ sync: { enabled: true, requested_at: at } }),
      ),
    ).toBe(true);
    expect(
      isSyncRequestPending(
        source({ sync: { enabled: true, requested_at: later } }, at),
      ),
    ).toBe(true);
    expect(
      isSyncRequestPending(
        source({ sync: { enabled: true, requested_at: at } }, at),
      ),
    ).toBe(false);
  });

  it("is not pending without a request or with sync off", () => {
    expect(isSyncRequestPending(source({ sync: { enabled: true } }))).toBe(
      false,
    );
    expect(
      isSyncRequestPending(
        source({ sync: { enabled: false, requested_at: at } }),
      ),
    ).toBe(false);
  });
});

describe("syncIntervalLabel", () => {
  it("uses the largest whole unit and the one-hour default", () => {
    expect(syncIntervalLabel(7200)).toEqual({
      key: "identity_sources.values.everyHours",
      count: 2,
    });
    expect(syncIntervalLabel(600)).toEqual({
      key: "identity_sources.values.everyMinutes",
      count: 10,
    });
    expect(syncIntervalLabel(90)).toEqual({
      key: "identity_sources.values.everySeconds",
      count: 90,
    });
    expect(syncIntervalLabel(null)).toEqual({
      key: "identity_sources.values.everyHours",
      count: 1,
    });
  });
});
