import { test as base } from "@playwright/test";
import { ApiHelper, isApiErrorMuted } from "../helpers/api-helper";
import { ResourcePage } from "../helpers/resource-page";
import { TestUserContext } from "../helpers/test-user-context";
import { YamlImportHelper } from "../helpers/yaml-import";

type ResourceFixtures = {
  yamlImport: YamlImportHelper;
  roles: ResourcePage;
  workspaces: ResourcePage;
  workspacePolicies: ResourcePage;
  engines: ResourcePage;
  modelCatalogs: ResourcePage;
  userProfiles: ResourcePage;
  apiHelper: ApiHelper;
  createTestUser: (permissions: string[]) => Promise<TestUserContext>;
};

export const test = base.extend<ResourceFixtures>({
  page: async ({ page }, use) => {
    page.on("response", async (res) => {
      if (res.status() >= 400 && !isApiErrorMuted()) {
        const body = await res.text().catch(() => "");
        console.log(`[API ${res.status()}] ${res.url()}\n${body}`);
      }
    });
    await use(page);
  },
  yamlImport: async ({ page }, use) => {
    await use(new YamlImportHelper(page));
  },
  roles: async ({ page }, use) => {
    await use(new ResourcePage(page, { routeName: "roles" }));
  },
  workspaces: async ({ page }, use) => {
    await use(new ResourcePage(page, { routeName: "workspaces" }));
  },
  workspacePolicies: async ({ page }, use) => {
    await use(new ResourcePage(page, { routeName: "role-assignments" }));
  },
  engines: async ({ page }, use) => {
    await use(
      new ResourcePage(page, { routeName: "engines", workspaced: true }),
    );
  },
  modelCatalogs: async ({ page }, use) => {
    await use(
      new ResourcePage(page, { routeName: "model-catalogs", workspaced: true }),
    );
  },
  userProfiles: async ({ page }, use) => {
    await use(new ResourcePage(page, { routeName: "user-profiles" }));
  },
  apiHelper: async ({ page }, use) => {
    await use(new ApiHelper(page));
  },
  createTestUser: async ({ page, browser }, use) => {
    const api = new ApiHelper(page);
    const contexts: TestUserContext[] = [];
    await use(async (permissions: string[]) => {
      const ctx = new TestUserContext(api, browser);
      await ctx.setup({ permissions });
      contexts.push(ctx);
      return ctx;
    });
    // Auto-cleanup all test users after test ends
    for (const ctx of contexts.reverse()) {
      await ctx.cleanup();
    }
  },
});

export { expect } from "@playwright/test";
