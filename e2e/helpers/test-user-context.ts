import type { Browser, BrowserContext, Page } from "@playwright/test";
import type { ApiHelper } from "./api-helper";

export interface TestUserOptions {
  /** Permissions to assign, e.g. ["role:read", "role:create"] */
  permissions: string[];
}

/**
 * Logout the current user by clicking the user dropdown → Logout button.
 * Waits for the login page to appear after logout.
 */
export async function logout(page: Page): Promise<void> {
  await page.locator("button:has(.lucide-chevron-down)").click();
  await page.getByText(/logout/i).click();
  await page.locator('input[name="email"]').waitFor({ state: "visible" });
}

/**
 * Create a new browser context, navigate to login, and authenticate.
 * Derives the app origin from the admin page (apiHelper) so the new
 * context resolves relative URLs correctly.
 *
 * Returns the page and context (caller must close context when done).
 */
export async function loginAs(
  browser: Browser,
  apiHelper: ApiHelper,
  email: string,
  password: string,
): Promise<{ page: Page; context: BrowserContext }> {
  const baseURL = new URL(apiHelper.page.url()).origin;
  // Clear storageState so we don't inherit the admin session from playwright config
  const context = await browser.newContext({
    baseURL,
    storageState: { cookies: [], origins: [] },
  });
  const page = await context.newPage();
  await page.goto("/#/login");
  // New context has no cache — wait for SPA JS bundle to load and render
  await page.locator('input[name="email"]').waitFor({ state: "visible" });
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/#/dashboard");
  return { page, context };
}

/**
 * Wraps the full lifecycle: create user → assign permissions → login → cleanup.
 */
export class TestUserContext {
  readonly name: string;
  readonly email: string;
  readonly password = "Test@123456";
  page!: Page;

  private roleName: string;
  private policyName: string;
  private context!: BrowserContext;
  private userId!: string;

  constructor(
    private api: ApiHelper,
    private browser: Browser,
  ) {
    const ts = Date.now();
    this.name = `test-user-${ts}`;
    this.email = `test-user-${ts}@e2e.local`;
    this.roleName = `test-role-${ts}`;
    this.policyName = `test-policy-${ts}`;
  }

  /** Create user + role + policy, login in a new browser context, return the page */
  async setup(options: TestUserOptions): Promise<Page> {
    // 1. Create user via admin API
    this.userId = await this.api.createUser(
      this.name,
      this.email,
      this.password,
    );
    // 2. Create role with specified permissions
    await this.api.createRole(this.roleName, options.permissions);
    // 3. Create global policy linking user to role
    await this.api.createPolicy(
      this.policyName,
      this.userId,
      this.roleName,
      true,
    );
    // 4. Login in new browser context
    const { page, context } = await loginAs(
      this.browser,
      this.api,
      this.email,
      this.password,
    );
    this.page = page;
    this.context = context;
    return this.page;
  }

  /** Close browser context and soft-delete all created resources */
  async cleanup(): Promise<void> {
    if (this.context) await this.context.close();
    // Delete in reverse dependency order
    await this.api.deletePolicy(this.policyName).catch(() => {});
    await this.api.deleteRole(this.roleName).catch(() => {});
    await this.api.deleteUser(this.name).catch(() => {});
  }
}
