import type { Page } from "@playwright/test";
import { FormHelper } from "./form-helper";
import { TableHelper } from "./table-helper";

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
}
