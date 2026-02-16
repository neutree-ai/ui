import type { Page } from "@playwright/test";
import { FormHelper } from "./form-helper";
import { DELETE_TIMEOUT, TableHelper } from "./table-helper";

export interface ResourcePageOptions {
  /** The route segment for this resource, e.g. "roles", "image-registries" */
  routeName: string;
  /** If true, URLs are prefixed with a workspace segment */
  workspaced?: boolean;
  /** Workspace name to use for workspaced resources (default: "default") */
  workspace?: string;
}

export class ResourcePage {
  readonly page: Page;
  readonly form: FormHelper;
  readonly table: TableHelper;
  readonly routeName: string;
  readonly workspaced: boolean;
  readonly workspace: string;

  constructor(page: Page, options: ResourcePageOptions) {
    this.page = page;
    this.form = new FormHelper(page);
    this.table = new TableHelper(page);
    this.routeName = options.routeName;
    this.workspaced = options.workspaced ?? false;
    this.workspace = options.workspace ?? "default";
  }

  /** Build the base path for this resource */
  private basePath(): string {
    if (this.workspaced) {
      return `/${this.workspace}/${this.routeName}`;
    }
    return `/${this.routeName}`;
  }

  /** Navigate to the list page */
  async goToList(): Promise<void> {
    await this.page.goto(`/#${this.basePath()}`);
    await this.table.waitForLoaded();
  }

  /** Navigate to the create page */
  async goToCreate(): Promise<void> {
    await this.page.goto(`/#${this.basePath()}/create`);
    await this.page
      .locator('[data-testid="form"]')
      .waitFor({ state: "visible" });
  }

  /** Navigate to the show page by resource id */
  async goToShow(id: string | number): Promise<void> {
    await this.page.goto(`/#${this.basePath()}/show/${id}`);
    await this.page
      .locator('[data-testid="show-page"]')
      .waitFor({ state: "visible" });
  }

  /** Navigate to the edit page by resource id */
  async goToEdit(id: string | number): Promise<void> {
    await this.page.goto(`/#${this.basePath()}/edit/${id}`);
    await this.page
      .locator('[data-testid="form"]')
      .waitFor({ state: "visible" });
  }

  /** Click the Create button on the list page */
  async clickCreate(): Promise<void> {
    await this.page.getByRole("link", { name: /create/i }).click();
    await this.page
      .locator('[data-testid="form"]')
      .waitFor({ state: "visible" });
  }

  /** Click Edit from the show page action menu */
  async showPageEdit(): Promise<void> {
    await this.page.locator('[data-testid="show-actions-trigger"]').click();
    await this.page.getByRole("link", { name: /edit/i }).click();
    await this.page
      .locator('[data-testid="form"]')
      .waitFor({ state: "visible" });
  }

  /** Click Delete from the show page action menu, confirm, then navigate to list and wait for the row to disappear */
  async showPageDelete(name: string): Promise<void> {
    await this.page.locator('[data-testid="show-actions-trigger"]').click();
    await this.page.getByRole("menuitem", { name: /delete/i }).click();
    const dialog = this.page.getByRole("alertdialog");
    await dialog.waitFor({ state: "visible" });
    await dialog.getByRole("button", { name: /delete/i }).click();
    await dialog.waitFor({ state: "hidden" });

    await this.goToList();
    await this.table.expectNoRowWithText(name, { timeout: DELETE_TIMEOUT });
  }
}
