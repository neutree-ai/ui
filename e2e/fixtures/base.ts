import { test as base } from "@playwright/test";
import { ResourcePage } from "../helpers/resource-page";

type ResourceFixtures = {
  roles: ResourcePage;
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
  roles: async ({ page }, use) => {
    await use(new ResourcePage(page, { routeName: "roles" }));
  },
});

export { expect } from "@playwright/test";
