import { type Page, expect } from "@playwright/test";

export class YamlImportHelper {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /** Open the Import YAML dialog, paste content, submit, and wait for results */
  async importYaml(yamlContent: string): Promise<void> {
    // Open the dialog
    await this.page.getByRole("button", { name: /import yaml/i }).click();
    const dialog = this.page.getByRole("dialog");
    await dialog.waitFor({ state: "visible" });

    // Fill the YAML textarea
    await dialog.locator("#yaml-text").fill(yamlContent);

    // Click the import button
    await dialog
      .getByRole("button", { name: /import/i })
      .last()
      .click();

    // Wait for results to appear (success/error badges)
    await expect(dialog.getByText(/success|error/i).first()).toBeVisible();
  }

  /** Assert import results: expected number of successes, skipped, and errors */
  async expectResults(opts: {
    success?: number;
    skipped?: number;
    errors?: number;
  }): Promise<void> {
    const dialog = this.page.getByRole("dialog");

    if (opts.success !== undefined) {
      await expect(dialog.getByText(`${opts.success} Success`)).toBeVisible();
    }
    if (opts.skipped !== undefined) {
      await expect(dialog.getByText(`${opts.skipped} Skipped`)).toBeVisible();
    }
    if (opts.errors !== undefined) {
      if (opts.errors === 0) {
        await expect(dialog.getByText(/Error/)).toBeHidden();
      } else {
        await expect(dialog.getByText(`${opts.errors} Error`)).toBeVisible();
      }
    }
  }

  /** Open the Import YAML dialog, set a file via the file input, submit, and wait for results */
  async importFromFile(yamlContent: string): Promise<void> {
    // Open the dialog
    await this.page.getByRole("button", { name: /import yaml/i }).click();
    const dialog = this.page.getByRole("dialog");
    await dialog.waitFor({ state: "visible" });

    // Set the file via the file input
    const buffer = Buffer.from(yamlContent, "utf-8");
    await dialog.locator("#file-upload").setInputFiles({
      name: "import.yaml",
      mimeType: "application/x-yaml",
      buffer,
    });

    // Click the import button
    await dialog
      .getByRole("button", { name: /import/i })
      .last()
      .click();

    // Wait for results to appear (success/error badges)
    await expect(dialog.getByText(/success|error/i).first()).toBeVisible();
  }

  /** Click "Import More" to reset the dialog for another import */
  async importMore(): Promise<void> {
    const dialog = this.page.getByRole("dialog");
    await dialog.getByRole("button", { name: /import more/i }).click();
    // Wait for the input form to reappear
    await expect(dialog.locator("#yaml-text")).toBeVisible();
  }

  /** Fill YAML and submit when the dialog is already open (e.g. after importMore) */
  async submitYaml(yamlContent: string): Promise<void> {
    const dialog = this.page.getByRole("dialog");

    // Fill the YAML textarea
    await dialog.locator("#yaml-text").fill(yamlContent);

    // Click the import button
    await dialog
      .getByRole("button", { name: /import/i })
      .last()
      .click();

    // Wait for results to appear (success/error badges)
    await expect(
      dialog.getByText(/success|skipped|error/i).first(),
    ).toBeVisible();
  }

  /** Close the import dialog */
  async close(): Promise<void> {
    const dialog = this.page.getByRole("dialog");
    await dialog.getByRole("button", { name: /close/i }).first().click();
    await dialog.waitFor({ state: "hidden" });
  }

  /** Shorthand: import YAML, verify no errors, and close */
  async importAndClose(yamlContent: string): Promise<void> {
    await this.importYaml(yamlContent);
    await this.expectResults({ errors: 0 });
    await this.close();
  }
}
