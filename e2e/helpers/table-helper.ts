import { type Locator, type Page, expect } from "@playwright/test";
import { DELETE_TIMEOUT } from "./constants";

export { DELETE_TIMEOUT };

export class TableHelper {
  readonly page: Page;
  readonly root: Locator;

  constructor(page: Page) {
    this.page = page;
    this.root = page.locator('[data-testid="table"]');
  }

  /** Wait for the table to finish loading (data rows or empty state visible) */
  async waitForLoaded(): Promise<void> {
    // First wait for the table to appear in the DOM
    await this.root.waitFor({ state: "visible" });
    // Then wait for either data rows or empty state — loading spinner gone
    const body = this.page.locator('[data-testid="table-body"]');
    await body.waitFor({ state: "visible" });
    // Wait until the loading row is gone (if it ever appeared)
    await this.page
      .locator('[data-testid="table-loading"]')
      .waitFor({ state: "hidden" });
    // Extra safety: wait for at least one non-loading row to be present
    await body
      .locator("tr:not([data-testid='table-loading'])")
      .first()
      .waitFor({ state: "visible" });
  }

  /** Locator for all data rows in the table body */
  rows(): Locator {
    return this.page
      .locator('[data-testid="table-body"]')
      .locator("tr")
      .filter({ hasNot: this.page.locator('[data-testid="table-loading"]') })
      .filter({ hasNot: this.page.locator('[data-testid="table-empty"]') });
  }

  /** Find a row that contains the given text */
  rowWithText(text: string): Locator {
    return this.page
      .locator('[data-testid="table-body"]')
      .locator("tr", { hasText: text });
  }

  /** Assert a row with the given text exists */
  async expectRowWithText(text: string): Promise<void> {
    await this.waitForLoaded();
    await expect(this.rowWithText(text)).toBeVisible();
  }

  /** Assert no row with the given text exists */
  async expectNoRowWithText(
    text: string,
    options?: { timeout?: number },
  ): Promise<void> {
    await this.waitForLoaded();
    await expect(this.rowWithText(text)).toBeHidden(options);
  }

  /** Click the link in a row (typically the name column) */
  async clickRowLink(text: string): Promise<void> {
    await this.waitForLoaded();
    await this.rowWithText(text).locator("a").first().click();
  }

  /** Open the row actions dropdown menu and click an item, retrying if the menu gets detached */
  private async clickRowAction(
    text: string,
    actionLocator: () => Promise<void>,
  ): Promise<void> {
    await this.waitForLoaded();
    const maxRetries = 3;
    for (let i = 0; i < maxRetries; i++) {
      await this.rowWithText(text)
        .locator('[data-testid="row-actions-trigger"]')
        .click();
      await this.page.locator('[role="menu"]').waitFor({ state: "visible" });
      try {
        await actionLocator();
        return;
      } catch {
        // Menu was detached due to re-render, close it and retry
        await this.page.keyboard.press("Escape");
      }
    }
    // Final attempt without catching
    await actionLocator();
  }

  /** Open row actions and click the Edit menu item */
  async editRow(text: string): Promise<void> {
    await this.clickRowAction(text, () =>
      this.page.getByRole("link", { name: /edit/i }).click(),
    );
  }

  /** Check whether a row has the actions trigger button */
  async hasRowActions(text: string): Promise<boolean> {
    await this.waitForLoaded();
    const trigger = this.rowWithText(text).locator(
      '[data-testid="row-actions-trigger"]',
    );
    return (await trigger.count()) > 0;
  }

  /** Get a column header cell by its visible text */
  headerCell(text: string | RegExp): Locator {
    return this.root.locator("thead th", { hasText: text });
  }

  /** Click the sort trigger in a column header and verify it becomes active */
  async sort(columnText: string | RegExp): Promise<void> {
    await this.waitForLoaded();
    const trigger = this.headerCell(columnText).locator(
      '[data-testid="sort-trigger"]',
    );
    await trigger.click();
    await this.waitForLoaded();
    await expect(trigger).not.toHaveAttribute("data-sort-direction", "none");
  }

  /** Toggle a column's visibility via the Columns dropdown */
  async toggleColumn(columnName: string | RegExp): Promise<void> {
    const columnsButton = this.page.getByRole("button", { name: /columns/i });
    await columnsButton.click();
    await this.page.getByRole("menuitemcheckbox", { name: columnName }).click();
    await this.page.keyboard.press("Escape");
  }

  /** Open row actions, click Delete, and confirm the dialog.
   *  Use `noWait: true` to skip waiting for the row to disappear (cleanup-only). */
  async deleteRow(text: string, options?: { noWait?: boolean }): Promise<void> {
    await this.clickRowAction(text, () =>
      this.page.getByRole("menuitem", { name: /delete/i }).click(),
    );
    // Wait for the confirm dialog to appear
    const dialog = this.page.getByRole("alertdialog");
    await dialog.waitFor({ state: "visible" });
    // Click the confirm button
    await dialog.getByRole("button", { name: /delete/i }).click();
    // Wait for the dialog to close
    await dialog.waitFor({ state: "hidden" });
    if (!options?.noWait) {
      await this.expectNoRowWithText(text, { timeout: DELETE_TIMEOUT });
    }
  }
}
