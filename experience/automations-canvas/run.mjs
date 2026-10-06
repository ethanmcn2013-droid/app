#!/usr/bin/env node
/**
 * Automations canvas: a browser check against a running production build.
 *
 *   node experience/automations-canvas/run.mjs --base http://localhost:4431
 *   node experience/automations-canvas/run.mjs --base http://localhost:4431 --capture <folder>
 *
 * Serve a review-mode production build first (`next build`, then
 * `next start`; see experience/reviews/2026-10-06-automations-canvas).
 * The surface has no server data, so there is no fixture: each run starts
 * from an empty browser, opens a starter and edits it the way a person would.
 * Expected result: `PASS automations canvas: <n> checks ...`.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { chromium } from "@playwright/test";

const require = createRequire(import.meta.url);
const { AxeBuilder } = require("@axe-core/playwright");

const args = process.argv.slice(2);
const flag = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const base = flag("--base") ?? "http://localhost:4431";
const capture = flag("--capture");
if (capture) mkdirSync(capture, { recursive: true });

const SIZES = [
  { name: "phone", width: 390, height: 844, touch: true },
  { name: "tablet", width: 768, height: 1024, touch: true },
  { name: "desk", width: 1440, height: 900, touch: false },
  { name: "wide", width: 1920, height: 1080, touch: false },
];
const THEMES = ["dark", "light"];
const BANNED = /\b(sprint|epic|backlog|stakeholder|kanban|burndown|velocity|workflow|dashboard|deliverable|okr|swimlane|ledger|node|nodes)\b|!|—/i;

let checks = 0;
const failures = [];
function check(ok, label) {
  checks += 1;
  if (!ok) failures.push(label);
}

const browser = await chromium.launch();
try {
  for (const size of SIZES) {
    for (const theme of THEMES) {
      const tag = `${size.name}-${theme}`;
      const context = await browser.newContext({
        viewport: { width: size.width, height: size.height },
        hasTouch: size.touch,
        reducedMotion: "reduce",
        deviceScaleFactor: 1,
      });
      await context.addInitScript((choice) => {
        try {
          if (!window.sessionStorage.getItem("seeded")) {
            window.localStorage.clear();
            window.sessionStorage.setItem("seeded", "1");
            // The review build's own "In development" pill is the shell's.
            window.sessionStorage.setItem("signal-tasks.devbanner_dismissed", "1");
          }
          window.localStorage.setItem("signal:theme-mode", choice);
        } catch {}
      }, theme);
      const page = await context.newPage();
      const errors = [];
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      page.on("pageerror", (error) => errors.push(String(error)));
      const shot = async (name, full = false) => {
        if (capture) await page.screenshot({ path: path.join(capture, `${name}-${tag}.png`), fullPage: full });
      };
      // Only this surface is judged: the shell around it has its own checks.
      const axe = async (label) => {
        const result = await new AxeBuilder({ page }).include("#app-main-content").analyze();
        check(result.violations.length === 0, `${tag}: axe, ${label} (${result.violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`).join("; ")})`);
      };
      const dismissNotice = async () => {
        const notice = page.getByRole("button", { name: /dismiss|got it|close notice/i }).first();
        if (await notice.isVisible().catch(() => false)) await notice.click().catch(() => {});
      };

      // ── The list, empty ────────────────────────────────────────────
      await page.goto(`${base}/app/automations`, { waitUntil: "networkidle" });
      await page.getByRole("heading", { name: "Automations", level: 1 }).waitFor();
      await dismissNotice();
      check((await page.getAttribute("html", "data-theme")) === theme, `${tag}: theme applied`);
      check(await page.getByText("No drafts yet").isVisible(), `${tag}: empty state`);
      check((await page.getByRole("button", { name: "New automation" }).count()) === 1, `${tag}: one create button`);
      check(await page.getByText("Automations are a preview.").isVisible(), `${tag}: preview notice`);
      check((await page.locator("section li button").count()) === 4, `${tag}: four starters`);
      const sideways = () => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      check(!(await sideways()), `${tag}: list has no sideways scroll`);
      await shot("list-empty", true);
      await axe("empty list");

      // ── Open a starter ─────────────────────────────────────────────
      await page.getByRole("button", { name: /Chase late tasks/ }).click();
      await page.waitForURL(/\/app\/automations\/.+/);
      const steps = page.locator("[data-step-id]");
      await steps.first().waitFor();
      await page.waitForTimeout(250);
      check((await steps.count()) === 6, `${tag}: starter has six steps`);
      check((await page.locator("[data-link-id]").count()) === 5, `${tag}: starter has five connections`);
      check(await page.getByText("Automations are a preview. Nothing runs yet.").isVisible(), `${tag}: status line`);
      const inView = await steps.evaluateAll((nodes) => {
        const canvas = document.querySelector("[data-phase]").getBoundingClientRect();
        return nodes.every((node) => {
          const box = node.getBoundingClientRect();
          return box.left >= canvas.left && box.right <= canvas.right && box.top >= canvas.top && box.bottom <= canvas.bottom;
        });
      });
      check(inView, `${tag}: fit shows every step`);
      await shot("canvas");
      await axe("canvas");

      // Coming soon controls: present, not usable, explained on focus.
      for (const name of ["Live", "Share", "Publish"]) {
        const control = page.getByRole("button", { name, exact: true });
        check((await control.getAttribute("aria-disabled")) === "true", `${tag}: ${name} is not usable`);
        await control.focus();
        const tip = page.locator(`#${(await control.getAttribute("aria-describedby")).replace(/:/g, "\\:")}`);
        const shown = await tip.waitFor({ state: "visible", timeout: 2000 }).then(() => true, () => false);
        check(shown && /Coming soon/.test(await tip.textContent()), `${tag}: ${name} says coming soon`);
      }
      await shot("coming-soon");
      await page.keyboard.press("Escape");

      // Connectors meet their ports.
      const joined = await page.evaluate(() => {
        const world = document.querySelector("[data-step-id]").parentElement;
        const scale = new DOMMatrix(getComputedStyle(world).transform).a;
        return [...document.querySelectorAll("[data-link-id]")].every((link) => {
          const dots = link.querySelectorAll("circle");
          const end = dots[1].getBoundingClientRect();
          const x = end.left + end.width / 2;
          const y = end.top + end.height / 2;
          return [...document.querySelectorAll("[data-step-id]")].some((step) => {
            const box = step.getBoundingClientRect();
            return Math.abs(box.left - x) < 2 && Math.abs(box.top + 64 * scale - y) < 2;
          });
        });
      });
      check(joined, `${tag}: every connector ends on a step's left port`);

      // ── Select, toolbar, handles, panel ────────────────────────────
      const first = steps.first();
      const before = await first.boundingBox();
      await page.mouse.click(before.x + before.width / 2, before.y + before.height * 0.2);
      check((await first.getAttribute("data-selected")) === "", `${tag}: click selects`);
      const toolbar = page.getByRole("toolbar", { name: /Actions for/ });
      check(await toolbar.isVisible(), `${tag}: step toolbar`);
      const run = page.getByRole("button", { name: "Run from here" });
      check((await run.getAttribute("aria-disabled")) === "true", `${tag}: run from here is not usable`);
      check((await page.getByRole("button", { name: /Add a step after/ }).count()) === 1, `${tag}: add-after handle`);
      await shot("selected");
      await axe("selected step");

      await page.getByRole("button", { name: "Edit this step" }).click();
      const panel = page.getByRole("complementary", { name: /Edit this step|steps selected/ });
      await panel.waitFor();
      check(await panel.getByLabel("Name").isVisible(), `${tag}: panel shows the name field`);
      if (size.width <= 760) {
        const box = await panel.boundingBox();
        check(Math.abs(box.y + box.height - (await page.locator("main").boundingBox()).height - (await page.locator("main").boundingBox()).y) < 40 && box.width >= size.width - 2, `${tag}: panel is a bottom sheet`);
      }
      await panel.getByLabel("Name").fill("A task slips past its date");
      check(await first.getByText("A task slips past its date").isVisible(), `${tag}: renaming shows on the canvas`);
      await shot("panel");
      await axe("edit panel");
      await page.keyboard.press("Escape");
      check(!(await panel.isVisible().catch(() => false)), `${tag}: Escape closes the panel`);

      // ── Drag a step; connectors follow; undo and redo ──────────────
      if (!size.touch) {
        const from = await first.boundingBox();
        await page.mouse.move(from.x + from.width / 2, from.y + from.height * 0.2);
        await page.mouse.down();
        await page.mouse.move(from.x + from.width / 2, from.y + from.height * 0.2 + 70, { steps: 6 });
        await page.mouse.up();
        const after = await first.boundingBox();
        check(Math.abs(after.y - from.y) > 20, `${tag}: dragging moves the step`);
        await page.keyboard.press("Control+z");
        const undone = await first.boundingBox();
        check(Math.abs(undone.y - from.y) < 2, `${tag}: undo puts it back`);
        await page.keyboard.press("Control+Shift+z");
        check(Math.abs((await first.boundingBox()).y - after.y) < 2, `${tag}: redo moves it again`);
        await page.keyboard.press("Control+z");

        // Zoom toward the pointer with Ctrl and the wheel.
        const zoomButton = page.getByRole("button", { name: /^Zoom \d+ percent/ });
        const label = await zoomButton.innerText();
        await page.mouse.move(size.width / 2, size.height / 2);
        await page.keyboard.down("Control");
        await page.mouse.wheel(0, -120);
        await page.keyboard.up("Control");
        check((await zoomButton.innerText()) !== label, `${tag}: Ctrl and wheel zooms`);
        await page.getByRole("button", { name: "Fit everything on screen" }).click();
        await page.waitForTimeout(200);

        // A circle is refused, and says so.
        const last = steps.nth(2);
        const port = last.locator("[data-port]");
        const a = await port.boundingBox();
        const b = await steps.nth(1).boundingBox();
        await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
        await page.mouse.down();
        await page.mouse.move(b.x + b.width / 2, b.y + b.height / 3, { steps: 8 });
        await shot("connecting");
        await page.mouse.up();
        check((await page.locator("[data-link-id]").count()) === 5, `${tag}: a circle is refused`);
        check(await page.getByText(/round in a circle/).first().isVisible(), `${tag}: the refusal is explained`);
      }

      // ── Keyboard: Tab reaches steps, arrows nudge, Enter edits, Delete removes ─
      await page.keyboard.press("Escape");
      await page.locator("[data-phase]").focus();
      await page.keyboard.press("Tab");
      const focused = () => page.evaluate(() => document.activeElement?.getAttribute("data-step-id"));
      const firstId = await first.getAttribute("data-step-id");
      check((await focused()) === firstId, `${tag}: Tab reaches the first step`);
      const beforeNudge = await first.boundingBox();
      await page.keyboard.press("ArrowDown");
      check((await first.boundingBox()).y > beforeNudge.y, `${tag}: arrow keys nudge`);
      await page.keyboard.press("Control+z");
      await page.keyboard.press("Enter");
      check(await panel.isVisible(), `${tag}: Enter opens the panel`);
      await page.keyboard.press("Escape");
      check((await focused()) === firstId, `${tag}: focus returns to the step`);

      // ── Add a step from the dock through the picker ────────────────
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Step", exact: true }).click();
      const picker = page.getByRole("dialog");
      await picker.waitFor();
      await picker.getByRole("combobox").fill("tag");
      check((await picker.getByRole("option").count()) === 1, `${tag}: picker search narrows`);
      await shot("picker");
      await axe("picker");
      await page.keyboard.press("Enter");
      check((await steps.count()) === 7, `${tag}: picker adds a step`);
      check(/Added Add a tag/.test(await page.locator("[role='status']").last().innerText()), `${tag}: live region announces`);
      await page.keyboard.press("Delete");
      check((await steps.count()) === 6, `${tag}: Delete removes the step`);

      // Words, layout, errors.
      const words = await page.locator("main").innerText();
      check(!BANNED.test(words), `${tag}: no banned words on the canvas (${(BANNED.exec(words) ?? [""])[0]})`);
      check(!(await sideways()), `${tag}: canvas has no sideways scroll`);
      const overlap = await page.evaluate(() => {
        const boxes = ["[aria-label='Steps and history']", "[aria-label='Zoom']", "[aria-label='Canvas tools']"]
          .map((selector) => document.querySelector(selector))
          .filter((node) => node && node.getClientRects().length > 0)
          .map((node) => node.getBoundingClientRect());
        return boxes.some((one, i) => boxes.some((two, j) => i < j && one.left < two.right && two.left < one.right && one.top < two.bottom && two.top < one.bottom));
      });
      check(!overlap, `${tag}: toolbars do not overlap`);

      // ── Back to the list: the draft is there, and survives a reload ─
      await page.goto(`${base}/app/automations`, { waitUntil: "networkidle" });
      await page.getByRole("heading", { name: "Your drafts" }).waitFor();
      check(await page.getByText("Edited just now").isVisible(), `${tag}: the draft is listed`);
      check(await page.getByText("6 steps").first().isVisible(), `${tag}: the draft counts its steps`);
      check(!BANNED.test(await page.locator("main").innerText()), `${tag}: no banned words on the list`);
      await shot("list", true);
      await axe("list with a draft");

      check(errors.length === 0, `${tag}: no console errors (${errors[0] ?? ""})`);
      await context.close();
    }
  }
} finally {
  await browser.close();
}

if (failures.length > 0) {
  console.error(`FAIL automations canvas: ${failures.length} of ${checks} checks`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`PASS automations canvas: ${checks} checks across phone, tablet, desk and wide, dark and light`);
