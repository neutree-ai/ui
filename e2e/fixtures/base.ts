import { test as base } from "@playwright/test";
import { ResourcePage } from "../helpers/resource-page";
import { YamlImportHelper } from "../helpers/yaml-import";

type ResourceFixtures = {
  yamlImport: YamlImportHelper;
  roles: ResourcePage;
  workspacePolicies: ResourcePage;
  engines: ResourcePage;
};

export const test = base.extend<ResourceFixtures>({
  page: async ({ page }, use) => {
    page.on("response", async (res) => {
      if (res.status() >= 400) {
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
  workspacePolicies: async ({ page }, use) => {
    await use(new ResourcePage(page, { routeName: "role-assignments" }));
  },
  engines: async ({ page }, use) => {
    await use(
      new ResourcePage(page, { routeName: "engines", workspaced: true }),
    );
  },
});

export { expect } from "@playwright/test";
