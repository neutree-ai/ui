import { expect, test } from "../fixtures/base";

// TestRail suite 2420, Access Log section.
//
// Access Log (a.k.a. ai-traces) surfaces per-request gateway traces. Entering a
// workspace's Access Log page requires the baseline `workspace:read`, so the
// Roles create form auto-selects and *locks* `workspace:read` the moment an
// endpoint/external-endpoint `trace-read` permission is chosen. These two cases
// are pure-UI (no trace data needed) and assert that linkage.
//
// Trace-data-dependent cases (view/detail + trace RBAC filtering) live in
// ai-traces-trace.spec.ts and are gated on a deployed e2e-engine endpoint.

interface TraceReadLinkSpec {
  caseId: string;
  /** Permission-group heading, matched exactly. */
  group: string;
  /** Number of actions in that group (for the "n/N Permissions" badge). */
  groupActions: number;
  /** The trace-read permission card label, matched exactly. */
  card: string;
}

const TRACE_READ_GROUPS: TraceReadLinkSpec[] = [
  {
    caseId: "C2710836",
    group: "Endpoints",
    groupActions: 5,
    card: "Endpoints:Access Log Read",
  },
  {
    caseId: "C2710837",
    group: "External Endpoints",
    groupActions: 5,
    card: "External Endpoints:Access Log Read",
  },
];

test.describe("access log — role permission auto-link", () => {
  for (const spec of TRACE_READ_GROUPS) {
    test(`${spec.card} auto-selects and locks Workspaces:Read`, {
      tag: `@${spec.caseId}`,
    }, async ({ roles }) => {
      await roles.goToCreate();
      await roles.form.fillInput(
        "metadata.name",
        `test-${spec.caseId.toLowerCase()}-${Date.now()}`,
      );

      const permField = roles.form.field("spec.permissions");
      const header = (title: string) =>
        permField.locator('[data-testid="permission-group-header"]').filter({
          has: roles.page.getByRole("heading", { name: title, exact: true }),
        });
      const groupHeader = header(spec.group);
      const wsHeader = header("Workspaces");

      // Baseline: nothing selected in either group; trace-read card present.
      await expect(
        groupHeader.getByText(`0/${spec.groupActions} Permissions`, {
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        wsHeader.getByText("0/5 Permissions", { exact: true }),
      ).toBeVisible();
      await expect(
        permField.getByText(spec.card, { exact: true }),
      ).toBeVisible();

      // Select the trace-read permission.
      await permField.getByText(spec.card, { exact: true }).click();

      // workspace:read is auto-selected: Workspaces 0/5 -> 1/5, and the
      // trace-read group shows its single selection.
      await expect(
        wsHeader.getByText("1/5 Permissions", { exact: true }),
      ).toBeVisible();
      await expect(
        groupHeader.getByText(`1/${spec.groupActions} Permissions`, {
          exact: true,
        }),
      ).toBeVisible();

      // The Workspaces:Read card is now locked (selected + non-deselectable).
      const wsReadCard = permField
        .locator("div")
        .filter({ hasText: /^Workspaces:Read$/ })
        .first();
      await expect(wsReadCard).toHaveClass(/cursor-not-allowed/);

      // Attempting to deselect it is a no-op: badge stays 1/5 and the
      // trace-read permission remains selected.
      await permField.getByText("Workspaces:Read", { exact: true }).click();
      await expect(
        wsHeader.getByText("1/5 Permissions", { exact: true }),
      ).toBeVisible();
      await expect(
        groupHeader.getByText(`1/${spec.groupActions} Permissions`, {
          exact: true,
        }),
      ).toBeVisible();
    });
  }
});
