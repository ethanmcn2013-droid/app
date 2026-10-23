import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * The shell has its surfaces, on the PRODUCTION BUILD.
 *
 * This suite runs against `next start` over the build CI just made (see
 * experience/settings-hydration.playwright.config.ts), never `next dev`.
 * That is the point: on 5 October 2026 the v3 shell reached production with
 * every `var(--v3-*)` undefined, so the sidebar, the cards, the borders and
 * the board columns all computed to nothing, while `next dev` and every
 * existing check stayed green. These assertions read computed styles, which
 * is where a missing token layer shows: an undefined custom property is not
 * an error, the declaration is simply dropped and the value computes to
 * transparent or to no border at all.
 *
 * Both themes, stated the way the app remembers a choice (this browser's
 * copy, src/lib/theme-mode.ts). With no choice the app is dark.
 */

type Rgba = [number, number, number, number];

async function chooseTheme(page: Page, theme: "light" | "dark" | null) {
  await page.addInitScript((choice) => {
    try {
      if (choice) window.localStorage.setItem("signal:theme-mode", choice);
      else window.localStorage.removeItem("signal:theme-mode");
    } catch {
      // Storage blocked: the app stays on its dark default.
    }
  }, theme);
}

/** Computed colours, read through a canvas so any CSS colour syntax parses. */
async function paint(page: Page, selector: string) {
  const handle = page.locator(selector).first();
  await expect(handle, selector).toBeVisible();
  return handle.evaluate((element) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true })!;
    const parse = (value: string): [number, number, number, number] => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = "rgba(0,0,0,0)";
      context.fillStyle = value;
      context.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
      return [r, g, b, a / 255];
    };
    const style = getComputedStyle(element);
    return {
      background: parse(style.backgroundColor),
      border: parse(style.borderTopColor),
      borderWidth: parseFloat(style.borderTopWidth) || 0,
      color: parse(style.color),
    };
  });
}

const opaque = (colour: Rgba) => colour[3] > 0.95;
const same = (a: Rgba, b: Rgba) => a.slice(0, 3).every((channel, index) => Math.abs(channel - b[index]) <= 2);
const luminance = (colour: Rgba) => {
  const [r, g, b] = colour.slice(0, 3).map((channel) => {
    const s = channel / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: Rgba, b: Rgba) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** Route styles can arrive after a visible streamed column. Read the three
 * surfaces together until their authored fill transition has settled. Missing
 * tokens and indistinguishable surfaces must still fail within the bound. */
async function expectBoardSurfaces(page: Page, timeout = 8_000) {
  await expect(async () => {
    const sheet = await paint(page, '[data-shell="v3"] > div:last-of-type');
    const lane = await paint(page, 'section[class*="board-module"][class*="__lane"]');
    expect(opaque(lane.background), `a board column has a fill: ${JSON.stringify(lane.background)}`).toBe(true);
    expect(same(lane.background, sheet.background), "a board column is a step away from the page").toBe(false);
    const card = await paint(page, 'article[class*="board-module"][class*="__card"]');
    expect(opaque(card.background), "a task card has a fill").toBe(true);
    expect(same(card.background, lane.background), "a task card is a step away from its column").toBe(false);
  }).toPass({ timeout, intervals: [20, 50, 100] });
}

test.use({ viewport: { width: 1440, height: 900 } });

// Synthetic instrument controls use the unchanged authored styles; they do not
// replace either theme's production-route check below.
const tokenStyles = readFileSync(path.join(process.cwd(), "src/ds/v3.css"), "utf8");
const boardStyles = readFileSync(path.join(process.cwd(), "src/components/tasks/board.module.css"), "utf8");
async function boardControl(page: Page, styles = boardStyles) {
  await page.setContent(`<html data-theme="dark"><head><style>${tokenStyles}</style><style>${styles}</style></head><body>
    <div data-shell="v3"><div style="background:var(--v3-canvas);padding:24px">
      <section class="lane board-module__lane" style="height:300px"><h2>In progress</h2>
        <article class="card board-module__card">A board surface control</article>
      </section>
    </div></div></body></html>`);
}

test("board surface readiness accepts late route styles", async ({ page }) => {
  await boardControl(page, "");
  const initial = await paint(page, 'section[class*="board-module"][class*="__lane"]');
  expect(opaque(initial.background), "the instrument first observes missing route styles").toBe(false);
  await page.screenshot({ path: test.info().outputPath("board-before-styles.png") });
  await page.evaluate((css) => {
    requestAnimationFrame(() => {
      const style = document.createElement("style");
      style.textContent = css;
      document.head.append(style);
    });
  }, boardStyles);
  await expectBoardSurfaces(page, 2_000);
  await page.screenshot({ path: test.info().outputPath("board-after-styles.png") });
});

for (const [name, styles, message] of [
  ["missing route styles", "", "a board column has a fill"],
  ["missing fill token", `${boardStyles}\n.lane{background:var(--missing-board-fill)}`, "a board column has a fill"],
  ["column matching its page", `${boardStyles}\n.lane{background:var(--v3-canvas)}`, "a board column is a step away from the page"],
  ["transparent task card", `${boardStyles}\n.card{background:transparent}`, "a task card has a fill"],
  ["card matching its column", `${boardStyles}\n.card{background:var(--v3-sunken)}`, "a task card is a step away from its column"],
] as const) {
  test(`board surface readiness rejects ${name}`, async ({ page }) => {
    await boardControl(page, styles);
    await expect(expectBoardSurfaces(page, 250)).rejects.toThrow(message);
  });
}

test("with no choice made, the app is dark on a light device", async ({ page }) => {
  await chooseTheme(page, null);
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/app/home");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).not.toHaveAttribute("data-theme-mode", /.+/);
  const sheet = await paint(page, '[data-shell="v3"] > div:last-of-type');
  expect(luminance(sheet.background), "the work sheet is a dark surface").toBeLessThan(0.05);
  await expect(page.getByRole("button", { name: "Theme: Dark. Switch to Light" })).toBeVisible();
});

for (const theme of ["dark", "light"] as const) {
  test.describe(`${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      await chooseTheme(page, theme);
      // The device says the opposite: the theme is a choice, not the device's.
      await page.emulateMedia({ colorScheme: theme === "dark" ? "light" : "dark" });
    });

    test("Home has its chrome, its sheet and its cards", async ({ page }) => {
      await page.goto("/app/home");
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

      const sidebar = await paint(page, '[data-shell="v3"] > aside');
      const sheet = await paint(page, '[data-shell="v3"] > div:last-of-type');
      expect(opaque(sidebar.background), "the sidebar has a ground of its own").toBe(true);
      expect(luminance(sidebar.background), "the sidebar is ink in both themes").toBeLessThan(0.02);
      expect(opaque(sheet.background), "the work sheet has a ground").toBe(true);
      expect(same(sidebar.background, sheet.background), "the chrome differs from the page").toBe(false);
      if (theme === "light") {
        expect(luminance(sheet.background), "the light page is light").toBeGreaterThan(0.8);
      } else {
        expect(luminance(sheet.background), "the dark page is dark").toBeLessThan(0.05);
      }

      // A sidebar icon reads on the rail (the glyph was pale grey on white
      // when the rail's ground came from the missing layer).
      const icon = await paint(page, '[data-shell="v3"] > aside nav[aria-label="Workspace"] a:not([aria-current]) svg');
      expect(contrast(icon.color, sidebar.background), "sidebar icon against the rail").toBeGreaterThanOrEqual(4.5);

      // The Done this week card: a fill, a border, and a step away from the page.
      const stat = await paint(page, 'section[aria-labelledby="home-week-title"]');
      expect(opaque(stat.background), "the card has a fill").toBe(true);
      expect(stat.borderWidth, "the card has a border").toBeGreaterThan(0);
      expect(opaque(stat.border), "the card border has a colour").toBe(true);
      expect(same(stat.border, stat.background), "the border is not the card's own colour").toBe(false);
      if (theme === "light") {
        // Light mode is white, ink and indigo only (founder instruction,
        // 12 Oct 2026): the card is white on the white page and its border
        // is what sets it apart, so the border must read against the page.
        expect(same(stat.background, sheet.background), "the light card is white on the white page").toBe(true);
        expect(same(stat.border, sheet.background), "the border reads against the page").toBe(false);
      } else {
        expect(same(stat.background, sheet.background), "the card is a step away from the page").toBe(false);
      }

      // A1 removes duplicate header search; the sidebar remains the single
      // reachable search entry and keeps its label on one line.
      await expect(page.locator('header button[aria-label="Search or jump to"]')).toHaveCount(0);
      const search = page.locator('[data-shell="v3"] > aside').getByRole("button", { name: "Search or jump to", exact: true });
      await expect(search).toHaveCount(1);
      await expect(search).toBeVisible();
      await expect(search).toBeEnabled();
      const box = await search.boundingBox();
      expect(box, "the sidebar search has measurable bounds").not.toBeNull();
      expect(box!.height).toBeGreaterThan(0);
      expect(box?.height ?? 0, "the search trigger is one line tall").toBeLessThanOrEqual(34);
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(200);
      const label = search.locator("span");
      expect(await label.evaluate((element) => getComputedStyle(element).whiteSpace)).toBe("nowrap");
      await search.focus();
      await expect(search).toBeFocused();
      await search.press("Enter");
      const palette = page.getByRole("dialog", { name: "Command palette", exact: true });
      await expect(palette).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(palette).toBeHidden();
    });

    test("the board's columns are surfaces", async ({ page }) => {
      await page.goto("/app/tasks");
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expectBoardSurfaces(page);
      await page.screenshot({ path: test.info().outputPath("board-surfaces.png") });
    });
  });
}
