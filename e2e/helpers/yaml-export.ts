import { type Page, expect } from "@playwright/test";
import { ASYNC_UI_TIMEOUT, BULK_TIMEOUT } from "./constants";

export class YamlExportHelper {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  private get dialog() {
    return this.page.getByRole("dialog");
  }

  /** Open the Export YAML dialog from the navbar */
  async open(): Promise<void> {
    await this.page.getByRole("button", { name: /export yaml/i }).click();
    await this.dialog.waitFor({ state: "visible" });
  }

  /** Close the export dialog (use .first() to avoid matching the Radix X button) */
  async close(): Promise<void> {
    await this.dialog.getByRole("button", { name: /close/i }).first().click();
    await this.dialog.waitFor({ state: "hidden" });
  }

  /** Click "Select All" button */
  async selectAll(): Promise<void> {
    await this.dialog.getByRole("button", { name: /select all/i }).click();
    // Wait for loading to finish (spinner disappears)
    await expect(
      this.dialog.getByRole("button", { name: /loading all/i }),
    ).toBeHidden({ timeout: BULK_TIMEOUT });
  }

  /** Click "Deselect All" button */
  async deselectAll(): Promise<void> {
    await this.dialog.getByRole("button", { name: /deselect all/i }).click();
  }

  /** Expand a resource type by clicking the chevron button */
  async expandResource(label: string): Promise<void> {
    const row = this.dialog.locator(".border.rounded-lg", {
      hasText: label,
    });
    // Click the chevron expand button (ghost button with w-8)
    await row.locator("button.h-8.w-8").click();
    // Wait for content to load (either entities or "No entities found")
    await expect(
      row.locator('[data-state="open"], [data-state="closed"]').first(),
    ).toBeVisible({ timeout: ASYNC_UI_TIMEOUT });
    // Wait a bit for lazy-loaded entities
    await this.page.waitForTimeout(500);
  }

  /** Toggle a resource type checkbox (select/deselect) */
  async toggleResource(label: string): Promise<void> {
    const row = this.dialog.locator(".border.rounded-lg", {
      hasText: label,
    });
    await row.locator('button[role="checkbox"]').click();
    // Wait for entities to load if selecting
    await this.page.waitForTimeout(500);
  }

  /** Open the settings dropdown (export options) */
  async openOptions(): Promise<void> {
    // The settings gear icon button
    await this.dialog
      .locator("button")
      .filter({ has: this.page.locator(".lucide-settings") })
      .click();
    // Wait for dropdown to appear
    await expect(this.page.locator('[role="menu"]')).toBeVisible();
  }

  /** Toggle an export option checkbox by its id */
  async toggleOption(
    id:
      | "remove-status"
      | "remove-ids"
      | "remove-timestamps"
      | "include-credentials",
  ): Promise<void> {
    await this.page.locator(`#${id}`).click();
  }

  /** Close the options dropdown */
  async closeOptions(): Promise<void> {
    await this.page.keyboard.press("Escape");
  }

  /** Click the "Reset" button on the selection screen */
  async clickReset(): Promise<void> {
    await this.dialog.getByRole("button", { name: /^reset$/i }).click();
  }

  /** Click "Generate YAML" button and wait for output */
  async generate(): Promise<void> {
    await this.dialog.getByRole("button", { name: /generate yaml/i }).click();
    // Wait for the output screen (textarea with generated YAML)
    await expect(this.dialog.locator("textarea[readonly]")).toBeVisible({
      timeout: BULK_TIMEOUT,
    });
  }

  /** Get the generated YAML content from the output textarea */
  async getYamlContent(): Promise<string> {
    return this.dialog.locator("textarea[readonly]").inputValue();
  }

  /** Click "Download File" and return the download */
  async downloadFile(): Promise<import("@playwright/test").Download> {
    const [download] = await Promise.all([
      this.page.waitForEvent("download"),
      this.dialog.getByRole("button", { name: /download file/i }).click(),
    ]);
    return download;
  }

  /** Click "Back to Selection" to return to the selection screen */
  async backToSelection(): Promise<void> {
    await this.dialog
      .getByRole("button", { name: /back to selection/i })
      .click();
  }

  /** Assert that the "Generate YAML" button is disabled */
  async expectGenerateDisabled(): Promise<void> {
    await expect(
      this.dialog.getByRole("button", { name: /generate yaml/i }),
    ).toBeDisabled();
  }

  /** Assert that the "Generate YAML" button is enabled */
  async expectGenerateEnabled(): Promise<void> {
    await expect(
      this.dialog.getByRole("button", { name: /generate yaml/i }),
    ).toBeEnabled();
  }

  /** Check if a resource row has entities listed (expanded state) */
  async getEntityNames(label: string): Promise<string[]> {
    const row = this.dialog.locator(".border.rounded-lg", {
      hasText: label,
    });
    const labels = row.locator(".pl-4 label.text-sm");
    const count = await labels.count();
    const names: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = await labels.nth(i).textContent();
      if (text) names.push(text.trim());
    }
    return names;
  }

  /** Check if a resource type shows "No entities found" */
  async hasNoEntities(label: string): Promise<boolean> {
    const row = this.dialog.locator(".border.rounded-lg", {
      hasText: label,
    });
    return (await row.getByText(/no entities found/i).count()) > 0;
  }
}
