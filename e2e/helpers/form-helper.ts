import type { Locator, Page } from "@playwright/test";

export class FormHelper {
  readonly page: Page;
  readonly root: Locator;

  constructor(page: Page) {
    this.page = page;
    this.root = page.locator('[data-testid="form"]');
  }

  /** Locator for a field wrapper by react-hook-form path */
  field(name: string): Locator {
    return this.page.locator(`[data-testid="field-${name}"]`);
  }

  /** Clear and fill a text input inside a field */
  async fillInput(name: string, value: string): Promise<void> {
    const input = this.field(name).locator("input");
    await input.clear();
    await input.fill(value);
  }

  /** Fill a textarea inside a field */
  async fillTextarea(name: string, value: string): Promise<void> {
    const textarea = this.field(name).locator("textarea");
    await textarea.clear();
    await textarea.fill(value);
  }

  /** Select an option from a Radix Select field */
  async selectOption(name: string, optionText: string): Promise<void> {
    const fieldLocator = this.field(name);
    // Click the trigger button to open the dropdown
    await fieldLocator.locator("button").click();
    // Select the option from the dropdown popover
    await this.page
      .getByRole("option", { name: optionText, exact: true })
      .click();
  }

  /** Select an option from a cmdk Combobox field.
   *  Scopes to the open popover dialog to avoid strict mode violations
   *  when multiple combobox popovers have same-named options in the DOM. */
  async selectComboboxOption(name: string, optionText: string): Promise<void> {
    const fieldLocator = this.field(name);
    await fieldLocator.locator("button").click();
    await this.page
      .locator('[data-state="open"][role="dialog"]')
      .getByRole("option", { name: optionText, exact: true })
      .click();
  }

  /** Toggle a checkbox field */
  async toggleCheckbox(name: string): Promise<void> {
    const fieldLocator = this.field(name);
    await fieldLocator.locator("button[role='checkbox']").click();
  }

  /** Click the submit button */
  async submit(): Promise<void> {
    await this.page.locator('[data-testid="form-submit"]').click();
  }

  /** Click the cancel button */
  async cancel(): Promise<void> {
    await this.page.locator('[data-testid="form-cancel"]').click();
  }
}
