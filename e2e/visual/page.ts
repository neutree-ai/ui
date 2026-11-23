import type { Page } from "@playwright/test";
import { VISUAL_NOW } from "../../src/foundation/testing/visual-fixtures";
import { installMockBackend, visualSession } from "./mock-backend";
import type { Screen } from "./screens";

const WORKSPACE_STORAGE_KEY = "__workspace__";
const DEFAULT_WIDTH = 1280;
const MAX_HEIGHT = 6000;

const FREEZE = `
  *, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }
`;

// The app scrolls inside its layout rather than the document, so the viewport
// is grown until nothing is hidden, and a clip of the page shows all of it.
async function fitViewportToContent(page: Page, width: number) {
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
      width,
      height: Math.min(height + extra, MAX_HEIGHT),
    });
  }
}

/**
 * Opens `screen` signed in, on mock data, with the clock frozen, and returns
 * the requests that had no mock once the page has settled.
 */
export async function openScreen(
  page: Page,
  baseURL: string,
  screen: Screen,
  width = DEFAULT_WIDTH,
): Promise<string[]> {
  const unmocked: string[] = [];
  await page.setViewportSize({ width, height: 800 });
  await page.clock.setFixedTime(new Date(VISUAL_NOW));
  await page.addInitScript(
    ({ session, key }) => {
      localStorage.setItem("supabase.auth.token", JSON.stringify(session));
      localStorage.setItem(key, JSON.stringify("default"));
    },
    { session: visualSession(), key: WORKSPACE_STORAGE_KEY },
  );
  await installMockBackend(
    page,
    new URL(baseURL).origin,
    screen.data,
    unmocked,
  );

  await page.goto(`/#${screen.route}`);
  await page
    .getByText(screen.ready, { exact: true })
    .first()
    .waitFor({ timeout: 20_000 });
  await page.addStyleTag({ content: FREEZE });
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  await fitViewportToContent(page, width);
  await page.waitForLoadState("networkidle");
  return unmocked;
}
