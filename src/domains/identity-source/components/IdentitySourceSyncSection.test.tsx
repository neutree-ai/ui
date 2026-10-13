import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import type {
  IdentitySource,
  IdentitySourceSyncStatus,
} from "@/domains/identity-source/types";

const mutate = vi.fn();
const invalidate = vi.fn();
const permission = vi.fn();

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options && "count" in options ? `${key}:${options.count}` : key,
  }),
}));

vi.mock("@/foundation/components/Timestamp", () => ({
  default: ({ timestamp }: { timestamp: string }) => <span>{timestamp}</span>,
}));

vi.mock("@/foundation/components/ShowPage", () => {
  const Slot = ({
    title,
    label,
    value,
    actions,
    children,
  }: Record<string, React.ReactNode>) => (
    <div>
      {title}
      {label}
      {value}
      {actions}
      <span>{children}</span>
    </div>
  );
  return { ShowPage: { Section: Slot, Row: Slot, SummaryItem: Slot } };
});

vi.mock("@/foundation/hooks/use-has-permission", () => ({
  useHasGlobalPermission: (name: string) => permission(name),
}));

vi.mock("@refinedev/core", () => ({
  useCustomMutation: () => ({ mutate, isLoading: false }),
  useInvalidate: () => invalidate,
}));

import { IdentitySourceLastSync } from "./IdentitySourceSyncResult";
import { IdentitySourceSyncSection } from "./IdentitySourceSyncSection";

const REQUESTED = "2026-10-13T08:00:00+00:00";

const source = ({
  syncEnabled = true,
  requestedAt,
  lastSync,
}: {
  syncEnabled?: boolean;
  requestedAt?: string;
  lastSync?: Partial<IdentitySourceSyncStatus>;
} = {}): IdentitySource =>
  ({
    id: 1,
    api_version: "v1",
    kind: "IdentitySource",
    metadata: { name: "org-ldap", display_name: "Org" },
    spec: {
      type: "ldap",
      enabled: true,
      ldap: {
        url: "ldap://x",
        bind_dn: "cn=a",
        user_base_dn: "ou=p",
        user_filter: "(uid={username})",
      },
      sync: { enabled: syncEnabled, interval: 600, requested_at: requestedAt },
    },
    status: lastSync ? { last_sync: { ok: true, ...lastSync } } : null,
  }) as IdentitySource;

const renderSection = (record: IdentitySource) =>
  render(
    <TooltipProvider>
      <IdentitySourceSyncSection record={record} />
    </TooltipProvider>,
  );

const syncNow = () =>
  screen.getByTestId("identity-source-sync-now") as HTMLButtonElement;

beforeEach(() => {
  mutate.mockReset();
  invalidate.mockReset();
  permission.mockReset().mockReturnValue({ allowed: true, isLoading: false });
});

describe("IdentitySourceSyncSection", () => {
  it("says sync is off and offers no sync while it is", () => {
    renderSection(source({ syncEnabled: false }));
    expect(screen.getByTestId("identity-source-sync-empty").textContent).toBe(
      "identity_sources.status.syncOff",
    );
    expect(screen.getByText("identity_sources.values.off")).toBeTruthy();
    expect(syncNow().disabled).toBe(true);
  });

  it("shows the schedule and an empty state before the first sync", () => {
    renderSection(source());
    expect(
      screen.getByText("identity_sources.values.everyMinutes:10"),
    ).toBeTruthy();
    expect(screen.getByTestId("identity-source-sync-empty").textContent).toBe(
      "identity_sources.status.notSynced",
    );
    expect(syncNow().disabled).toBe(false);
  });

  it("shows a request that has not reported back as pending", () => {
    renderSection(source({ requestedAt: REQUESTED }));
    expect(screen.getByTestId("identity-source-sync-result").textContent).toBe(
      "identity_sources.syncResults.pending",
    );
    expect(screen.getByTestId("identity-source-sync-empty").textContent).toBe(
      "identity_sources.status.syncWaiting",
    );
    expect(syncNow().disabled).toBe(true);
    expect(syncNow().textContent).toBe("identity_sources.actions.syncing");
  });

  it("shows the outcome, times and counts of the last sync", () => {
    renderSection(
      source({
        requestedAt: REQUESTED,
        lastSync: {
          requested_at: REQUESTED,
          started_at: "2026-10-13T08:00:01Z",
          finished_at: "2026-10-13T08:00:03Z",
          last_success_time: "2026-10-13T08:00:03Z",
          message: "3 created",
          created: 3,
          memberships: 5,
        },
      }),
    );
    expect(screen.getByTestId("identity-source-sync-result").textContent).toBe(
      "identity_sources.syncResults.ok",
    );
    expect(
      screen.getByTestId("identity-source-sync-count-created").textContent,
    ).toBe("3");
    expect(
      screen.getByTestId("identity-source-sync-count-memberships").textContent,
    ).toBe("5");
    expect(
      screen.getByTestId("identity-source-sync-count-deactivated").textContent,
    ).toBe("0");
    expect(screen.getByText("3 created")).toBeTruthy();
    expect(syncNow().disabled).toBe(false);
  });

  it("shows a failed sync with its message and the last success", () => {
    renderSection(
      source({
        lastSync: {
          ok: false,
          started_at: "2026-10-13T09:00:00Z",
          finished_at: "2026-10-13T09:00:02Z",
          last_success_time: "2026-10-13T08:00:03Z",
          message: "ldap: connection refused",
          pending: 4,
        },
      }),
    );
    expect(screen.getByTestId("identity-source-sync-result").textContent).toBe(
      "identity_sources.syncResults.failed",
    );
    expect(screen.getByText("ldap: connection refused")).toBeTruthy();
    expect(screen.getByText("2026-10-13T08:00:03Z")).toBeTruthy();
    expect(
      screen.getByTestId("identity-source-sync-count-pending").textContent,
    ).toBe("4");
  });
});

describe("Sync now", () => {
  it("asks for a sync of the source by name and refreshes it", () => {
    renderSection(source());
    fireEvent.click(syncNow());
    expect(mutate).toHaveBeenCalledTimes(1);
    const [request, callbacks] = mutate.mock.calls[0];
    expect(request).toMatchObject({
      url: "/rpc/request_identity_source_sync",
      method: "post",
      values: { p_name: "org-ldap" },
    });
    callbacks.onSuccess();
    expect(invalidate).toHaveBeenCalledWith(
      expect.objectContaining({ resource: "identity_sources", id: "org-ldap" }),
    );
  });

  it("checks identity_source:update and is hidden without it", () => {
    permission.mockReturnValue({ allowed: false, isLoading: false });
    renderSection(source());
    expect(permission).toHaveBeenCalledWith("identity_source:update");
    expect(screen.queryByTestId("identity-source-sync-now")).toBeNull();
  });
});

describe("IdentitySourceLastSync", () => {
  it("renders a dash before any sync, else the outcome and time", () => {
    const { rerender } = render(
      <IdentitySourceLastSync record={source({ syncEnabled: false })} />,
    );
    expect(screen.getByTestId("identity-source-sync-result").textContent).toBe(
      "-",
    );
    rerender(
      <IdentitySourceLastSync
        record={source({
          lastSync: { ok: false, finished_at: "2026-10-13T09:00:02Z" },
        })}
      />,
    );
    expect(screen.getByTestId("identity-source-sync-result").textContent).toBe(
      "identity_sources.syncResults.failed",
    );
    expect(screen.getByText("2026-10-13T09:00:02Z")).toBeTruthy();
  });
});
