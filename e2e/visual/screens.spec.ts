import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { VISUAL_NOW } from "../../src/foundation/testing/visual-fixtures";
import { installMockBackend, visualSession } from "./mock-backend";
import { screens } from "./screens";

const outDir = path.resolve(process.env.VISUAL_OUT_DIR ?? "visual-out");
mkdirSync(outDir, { recursive: true });

const WORKSPACE_STORAGE_KEY = "__workspace__";

const FREEZE = `
  *, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }
`;

const MAX_HEIGHT = 6000;

// The app scrolls inside its layout rather than the document, so a full-page
// capture would stop at the viewport. Grow the viewport to fit the content.
async function fitViewportToContent(page: Page) {
  for (let pass = 0; pass < 3; pass++) {
    const extra = await page.evaluate(() => {
      let hidden = document.documentElement.scrollHeight - window.innerHeight;
      for (const el of document.querySelectorAll("*")) {
        hidden = Math.max(hidden, el.scrollHeight - el.clientHeight);
      }
      return hidden;
    });
    if (extra <= 0) return;
    const { height } = page.viewportSize() ?? { height: 800 };
    await page.setViewportSize({
      width: 1280,
      height: Math.min(height + extra, MAX_HEIGHT),
    });
  }
}

for (const screen of screens) {
  test(screen.id, async ({ page, baseURL }) => {
    const unmocked: string[] = [];
    await page.clock.setFixedTime(new Date(VISUAL_NOW));
    await page.addInitScript(
      ({ session, workspace }) => {
        localStorage.setItem("supabase.auth.token", JSON.stringify(session));
        localStorage.setItem(workspace.key, JSON.stringify(workspace.value));
      },
      {
        session: visualSession(),
        workspace: { key: WORKSPACE_STORAGE_KEY, value: "default" },
      },
    );
    await installMockBackend(
      page,
      new URL(baseURL ?? "").origin,
      screen.data,
      unmocked,
    );

    await page.goto(`/#${screen.route}`);
    await expect(
      page.getByText(screen.ready, { exact: true }).first(),
    ).toBeVisible();
    await page.addStyleTag({ content: FREEZE });
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => document.fonts.ready);
    await fitViewportToContent(page);
    await page.waitForLoadState("networkidle");

    await page.screenshot({
      path: path.join(outDir, `${screen.id}.png`),
      fullPage: true,
    });
    writeFileSync(
      path.join(outDir, `${screen.id}.unmocked.json`),
      JSON.stringify([...new Set(unmocked)]),
    );
  });
}
