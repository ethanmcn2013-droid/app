// Suite design-review screenshot harness — the fixed "before" of the
// 2026-08 visual re-exploration.
//
//   node scripts/design/reference-shots.mjs \
//     --out docs/design/shots/reference-2026-08 --base http://localhost:3510
//
// Sibling of scripts/design/notes-shots.mjs, widened to the whole signed-in
// app: Home, Tasks, Notes and Timeline, at the four viewports the experience
// registry already names (experience/registry.json → breakpoints).
//
// Every scene is a pure navigation plus an optional scripted interaction, so a
// run is reproducible. Content is the real review-mode fixture (The Orchard,
// events) — never placeholder text.
//
// Loading scenes are captured honestly: the target route's RSC payload is
// held open by a route interceptor and the shot is taken while Next is
// painting the route's own loading.tsx. That means the loading frame is the
// real one the product ships, not a mock.
//
// Flags:
//   --only=slug,slug        capture a subset of scenes
//   --viewports=1440x960    capture a subset of viewports
//   --skip-loading          omit the loading scenes (they cost ~5s each)
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const args = new Map(
  process.argv.slice(2).map((raw) => {
    const [key, ...rest] = raw.replace(/^--/, "").split("=");
    return [key, rest.length ? rest.join("=") : "true"];
  }),
);

const BASE = args.get("base") ?? "http://localhost:3510";
const OUT = args.get("out") ?? "docs/design/shots/scratch";
const ONLY = args.get("only")?.split(",").map((v) => v.trim()).filter(Boolean) ?? null;
const VIEWPORT_FILTER = args.get("viewports")?.split(",").map((v) => v.trim()) ?? null;
const SKIP_LOADING = args.get("skip-loading") === "true";

/* The four breakpoints named by experience/registry.json. Same names, so a
   reference frame and a council frame are directly comparable. */
const VIEWPORTS = [
  { name: "390x844", width: 390, height: 844, isMobile: true },
  { name: "768x1024", width: 768, height: 1024, isMobile: false },
  { name: "1280x900", width: 1280, height: 900, isMobile: false },
  { name: "1440x960", width: 1440, height: 960, isMobile: false },
];

const PROJECT_SLUG = "mara-finn";

/**
 * Navigate and settle.
 *
 * `networkidle` never fires on the Tasks board — the runtime keeps a
 * connection open — so idle is a best effort with a ceiling, and the shot
 * always waits a fixed settle after it either way.
 */
async function settle(page, url, { idleCeiling = 4000, quiet = 700 } = {}) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  try {
    await page.waitForLoadState("networkidle", { timeout: idleCeiling });
  } catch {
    /* a live connection, not a stalled page */
  }
  await page.waitForTimeout(quiet);
}

/** Click the first control matching any selector in the list. */
async function clickFirst(page, selectors, { timeout = 2500 } = {}) {
  for (const selector of selectors) {
    const locator = page.locator(selector).locator("visible=true").first();
    try {
      await locator.waitFor({ state: "visible", timeout });
      await locator.click({ timeout });
      return true;
    } catch {
      /* try the next candidate */
    }
  }
  return false;
}

/**
 * @type {{
 *   slug: string,
 *   product: "home"|"tasks"|"notes"|"timeline",
 *   state: string,
 *   url?: string,
 *   loadingFor?: string,
 *   from?: string,
 *   viewports?: string[],
 *   act?: (page: import("@playwright/test").Page, viewport: {name: string, width: number}) => Promise<void>,
 * }[]}
 */
const SCENES = [
  /* ── Home ─────────────────────────────────────────────────────── */
  { slug: "home", product: "home", state: "populated", url: "/app/home" },
  { slug: "home-briefing", product: "home", state: "populated", url: "/app/home/briefing" },
  {
    slug: "home-loading",
    product: "home",
    state: "loading",
    loadingFor: "/app/home",
    from: "/app/notes",
    linkSelectors: ['a[href^="/app/home"]', 'a[aria-label="Signal Studio Home"]'],
  },

  /* ── Tasks ────────────────────────────────────────────────────── */
  { slug: "tasks-board", product: "tasks", state: "populated", url: "/app/tasks" },
  { slug: "tasks-list", product: "tasks", state: "populated", url: "/app/tasks/list" },
  { slug: "tasks-schedule", product: "tasks", state: "populated", url: "/app/tasks/timeline" },
  { slug: "tasks-calendar", product: "tasks", state: "populated", url: "/app/tasks/calendar" },
  { slug: "tasks-my-tasks", product: "tasks", state: "populated", url: "/app/my-tasks" },
  { slug: "tasks-project", product: "tasks", state: "populated", url: "/app/project" },
  {
    slug: "tasks-loading",
    product: "tasks",
    state: "loading",
    loadingFor: "/app/tasks",
    from: "/app/home",
    linkSelectors: ['a[href^="/app/tasks"]'],
  },
  {
    slug: "tasks-board-planning",
    product: "tasks",
    state: "planning-open",
    url: "/app/tasks",
    async act(page) {
      await clickFirst(page, [
        'button:has-text("Planning")',
        '[data-slot="planning-trigger"]',
      ]);
      await page.waitForTimeout(700);
    },
  },
  {
    slug: "tasks-board-detail",
    product: "tasks",
    state: "task-detail",
    url: "/app/tasks",
    async act(page) {
      await clickFirst(page, ["button[data-task-id]", "[data-task-id]"]);
      await page.waitForTimeout(700);
    },
  },
  {
    slug: "tasks-palette",
    product: "tasks",
    state: "command-palette",
    url: "/app/tasks",
    async act(page) {
      await page.keyboard.press("Control+k");
      await page.waitForTimeout(600);
    },
  },
  {
    slug: "tasks-board-empty-search",
    product: "tasks",
    state: "empty-result",
    url: "/app/tasks",
    async act(page) {
      await page.keyboard.press("Control+k");
      await page.waitForTimeout(400);
      await page.keyboard.type("zzzqqq");
      await page.waitForTimeout(600);
    },
  },

  /* ── Notes ────────────────────────────────────────────────────── */
  { slug: "notes-notebook", product: "notes", state: "populated", url: "/app/notes" },
  { slug: "notes-empty", product: "notes", state: "empty", url: "/app/notes?fixture=empty" },
  { slug: "notes-dense", product: "notes", state: "dense", url: "/app/notes?fixture=dense" },
  { slug: "notes-first-use", product: "notes", state: "first-use", url: "/app/notes?fixture=first-use" },
  { slug: "notes-long-content", product: "notes", state: "long-content", url: "/app/notes?fixture=long-content" },
  { slug: "notes-review", product: "notes", state: "populated", url: "/app/notes?view=review" },
  { slug: "notes-sent", product: "notes", state: "populated", url: "/app/notes?view=sent" },
  {
    slug: "notes-loading",
    product: "notes",
    state: "loading",
    loadingFor: "/app/notes",
    from: "/app/home",
    linkSelectors: ['a[href^="/app/notes"]'],
  },

  /* ── Timeline ─────────────────────────────────────────────────── */
  { slug: "timeline-owner", product: "timeline", state: "populated", url: "/app/timeline" },
  {
    slug: "timeline-project",
    product: "timeline",
    state: "populated",
    url: `/app/timeline/${PROJECT_SLUG}`,
  },
  { slug: "timeline-audience", product: "timeline", state: "populated", url: "/app/timeline/audience" },
  {
    slug: "timeline-loading",
    product: "timeline",
    state: "loading",
    loadingFor: "/app/timeline",
    from: "/app/home",
    linkSelectors: ['a[href^="/app/timeline"]'],
  },
];

/**
 * The real loading frame, photographed rather than mocked.
 *
 * Two facts about this app decide the technique. `/app/layout.tsx` is
 * `force-dynamic`, so Next never prefetches a loading shell and a CLIENT
 * navigation between products shows the previous page until the next one
 * arrives — there is no route-level loading frame to catch there. On a cold
 * load the server streams the shell first: chrome, then the `/app` Suspense
 * fallback (`SuiteLoading`), then the real content in a later chunk.
 *
 * So the loading state a person actually sees is that first chunk. We serve
 * exactly it: fetch the page's own HTML, cut at the first streamed
 * replacement container, and hand the browser the prefix. Every pixel is the
 * product's own markup and CSS, rendered by a real browser — the shot is the
 * shipped loading state held still, not a reconstruction.
 */
async function captureLoading(page, scene, file) {
  const url = `${BASE}${scene.loadingFor}`;
  const handler = async (route) => {
    const response = await route.fetch();
    const html = await response.text();
    const cut = html.indexOf('<div hidden id="S:');
    if (cut < 0) {
      await route.fulfill({ response });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
      body: html.slice(0, cut),
    });
  };
  await page.route(url, handler);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(900);
    await page.screenshot({ path: file, fullPage: false });
  } finally {
    await page.unroute(url, handler);
  }
  return { ok: true };
}

async function shoot() {
  const browser = await chromium.launch();
  let scenes = ONLY ? SCENES.filter((scene) => ONLY.includes(scene.slug)) : SCENES;
  if (SKIP_LOADING) scenes = scenes.filter((scene) => !scene.loadingFor);
  const viewports = VIEWPORT_FILTER
    ? VIEWPORTS.filter((viewport) => VIEWPORT_FILTER.includes(viewport.name))
    : VIEWPORTS;
  await mkdir(OUT, { recursive: true });

  const manifest = [];

  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 2,
      hasTouch: Boolean(viewport.isMobile),
      isMobile: Boolean(viewport.isMobile),
      reducedMotion: "no-preference",
      colorScheme: "light",
    });
    // Dismiss the in-development pill exactly the way a reviewer would: set
    // the same session key the banner's own close button writes. No
    // production bypass, and the banner still ships everywhere else.
    await context.addInitScript(() => {
      try {
        sessionStorage.setItem("signal-tasks.devbanner_dismissed", "1");
      } catch {
        /* private mode: the pill stays, the shot is still valid */
      }
    });
    const page = await context.newPage();
    const errors = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(String(error)));

    for (const scene of scenes) {
      if (scene.viewports && !scene.viewports.includes(viewport.name)) continue;
      const file = path.join(OUT, `${scene.slug}--${viewport.name}.png`);
      const record = {
        slug: scene.slug,
        product: scene.product,
        state: scene.state,
        viewport: viewport.name,
        file: path.basename(file),
        url: scene.url ?? scene.loadingFor,
      };

      if (scene.loadingFor) {
        const result = await captureLoading(page, scene, file);
        if (!result.ok) {
          record.skipped = result.reason;
          manifest.push(record);
          process.stdout.write(`  skip ${scene.slug}@${viewport.name}: ${result.reason}\n`);
          continue;
        }
      } else {
        await settle(page, `${BASE}${scene.url}`);
        if (scene.act) await scene.act(page, viewport);
        await page.waitForTimeout(300);
        await page.screenshot({ path: file, fullPage: false });
      }

      manifest.push(record);
      process.stdout.write(`${file}\n`);
    }

    if (errors.length) {
      process.stdout.write(`  console errors @${viewport.name}:\n`);
      for (const error of [...new Set(errors)]) process.stdout.write(`   - ${error}\n`);
    }
    await context.close();
  }
  await browser.close();

  await writeFile(
    path.join(OUT, "manifest.json"),
    `${JSON.stringify({ base: BASE, viewports: viewports.map((v) => v.name), shots: manifest }, null, 2)}\n`,
    "utf8",
  );
}

shoot().catch((error) => {
  console.error(error);
  process.exit(1);
});
