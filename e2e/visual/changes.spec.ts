import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { type Locator, type Page, test } from "@playwright/test";
import type { Capture, Change, ChangeSpec } from "./changes";
import { openScreen } from "./page";
import { screens } from "./screens";

const outDir = path.resolve(process.env.VISUAL_OUT_DIR ?? "visual-out");
const specPath = process.env.VISUAL_SPEC;
if (!specPath) throw new Error("VISUAL_SPEC must name a change spec file");
const { changes }: ChangeSpec = JSON.parse(readFileSync(specPath, "utf8"));
mkdirSync(outDir, { recursive: true });

const PAD = 24;
const MIN_WIDTH = 640;
const MIN_HEIGHT = 120;
const MAX_MATCHES = 12;

type Box = { x: number; y: number; width: number; height: number };

const HIGHLIGHT_COLOR = "255, 45, 85";

/** Draws outlines and numbered badges over `boxes` without touching the layout. */
async function drawHighlights(page: Page, boxes: Box[]) {
  await page.evaluate(
    ({ boxes, color }) => {
      const layer = document.createElement("div");
      layer.id = "visual-report-overlay";
      layer.style.cssText =
        "position:fixed;inset:0;pointer-events:none;z-index:2147483647";
      boxes.forEach((box, index) => {
        const frame = document.createElement("div");
        frame.style.cssText = `position:absolute;left:${box.x - 2}px;top:${box.y - 2}px;width:${box.width + 4}px;height:${box.height + 4}px;box-sizing:border-box;border:2px solid rgb(${color});background:rgba(${color},0.12);border-radius:3px`;
        const badge = document.createElement("div");
        badge.textContent = String(index + 1);
        badge.style.cssText = `position:absolute;left:-12px;top:-12px;min-width:20px;height:20px;padding:0 4px;box-sizing:border-box;border-radius:10px;background:rgb(${color});color:#fff;font:700 12px/20px system-ui,sans-serif;text-align:center`;
        frame.appendChild(badge);
        layer.appendChild(frame);
      });
      document.body.appendChild(layer);
    },
    { boxes, color: HIGHLIGHT_COLOR },
  );
}

async function boxesOf(locator: Locator): Promise<Box[]> {
  const count = Math.min(await locator.count(), MAX_MATCHES);
  const boxes: Box[] = [];
  for (let i = 0; i < count; i++) {
    const item = locator.nth(i);
    const box = await item.boundingBox();
    if (box && box.width > 0 && box.height > 0) boxes.push(box);
  }
  return boxes;
}

/** The padded union of `boxes`, widened to a readable minimum and kept on the page. */
function regionAround(
  boxes: Box[],
  viewport: { width: number; height: number },
): Box {
  const left = Math.min(...boxes.map((b) => b.x)) - PAD;
  const top = Math.min(...boxes.map((b) => b.y)) - PAD;
  const right = Math.max(...boxes.map((b) => b.x + b.width)) + PAD;
  const bottom = Math.max(...boxes.map((b) => b.y + b.height)) + PAD;
  const width = Math.min(viewport.width, Math.max(MIN_WIDTH, right - left));
  const height = Math.min(viewport.height, Math.max(MIN_HEIGHT, bottom - top));
  const x = Math.max(
    0,
    Math.min(viewport.width - width, (left + right) / 2 - width / 2),
  );
  const y = Math.max(
    0,
    Math.min(viewport.height - height, (top + bottom) / 2 - height / 2),
  );
  return { x, y, width, height };
}

async function capture(page: Page, baseURL: string, change: Change) {
  const screen = screens.find((s) => s.id === change.screen);
  if (!screen)
    throw new Error(`${change.id}: unknown screen "${change.screen}"`);
  const setup = change.setup ?? {};
  const unmocked = await openScreen(page, baseURL, screen, setup.viewport);

  if (setup.click) await page.locator(setup.click).first().click();
  if (setup.hover) {
    await page.locator(setup.hover).first().hover();
    // A tooltip opens after a delay; wait for the first highlight if it is one.
    await page
      .locator(change.highlight[0] ?? setup.hover)
      .first()
      .waitFor({ timeout: 3000 })
      .catch(() => {});
  }

  // The viewport was grown to the page's height, so boxes are page positions.
  const matches: number[] = [];
  const boxes: Box[] = [];
  for (const selector of change.highlight) {
    const found = await boxesOf(page.locator(selector));
    matches.push(found.length);
    boxes.push(...found);
  }
  if (boxes.length > 0) await drawHighlights(page, boxes);

  let regionMatched: boolean | null = null;
  let around = boxes;
  if (change.region) {
    const found = await boxesOf(page.locator(change.region));
    regionMatched = found.length > 0;
    if (regionMatched) around = [...boxes, ...found];
  }
  if (around.length === 0) {
    // Nothing to highlight on this side: show where it would be.
    const target = setup.hover ?? setup.click;
    if (target) around = await boxesOf(page.locator(target));
  }
  const viewport = page.viewportSize() ?? { width: 1280, height: 800 };
  const clip =
    around.length > 0
      ? regionAround(around, viewport)
      : {
          x: 0,
          y: 0,
          width: viewport.width,
          height: Math.min(viewport.height, 800),
        };

  await page.screenshot({
    path: path.join(outDir, `${change.id}.png`),
    clip,
  });
  const result: Capture = {
    id: change.id,
    matches,
    regionMatched,
    unmocked: [...new Set(unmocked)],
  };
  writeFileSync(path.join(outDir, `${change.id}.json`), JSON.stringify(result));
}

for (const change of changes) {
  test(change.id, async ({ page, baseURL }) => {
    await capture(page, baseURL ?? "", change);
  });
}
