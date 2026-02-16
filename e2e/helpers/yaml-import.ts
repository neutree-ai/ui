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
