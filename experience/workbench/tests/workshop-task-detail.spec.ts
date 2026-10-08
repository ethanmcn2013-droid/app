import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  isCompletedQualifiedViewResponse, isIntentionalEventSourceDisableResponse,
  normalizeUrl, runtimeFailures, type RuntimeWatch,
} from "../../runtime-policy";

const contract = JSON.parse(readFileSync("experience/browser-contract.json", "utf8"));
const taskName = "Confirm marquee sides with the hire company";
const variants = ["record-first", "context-first"] as const;
type Variant = typeof variants[number];
const checkNames = ["section-order", "original-controls", "initial-axe", "initial-overflow",
  "keyboard-open-close-focus", "popover-escape", "title-edit", "priority-edit", "notes-edit",
  "expand-baseline", "navigation-selector", "invalid-selector-default", "long-content", "runtime"];
type Case = {
  variant: Variant; viewport: string; passed: boolean; initialCaptureBeforeEditing: boolean;
  initialStateDigest: string | null; checks: { name: string; passed: boolean; failure?: string }[];
  failure: string | null; metrics: Record<string, unknown>; initialState?: unknown;
};
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
function digest(value: unknown) { return `sha256:${createHash("sha256").update(canonical(value)).digest("hex")}`; }
function watchRuntime(page: Page): RuntimeWatch {
  const runtime: RuntimeWatch = { issues: [], intentionalEventSourceTeardowns: new Set(), completedQualifiedViewWrites: new Set() };
  page.on("pageerror", error => runtime.issues.push({ kind: "pageerror", message: error.message }));
  page.on("console", message => {
    if (message.type() === "error") runtime.issues.push({ kind: "console", message: message.text(), url: message.location().url });
  });
  page.on("response", response => {
    const request = response.request();
    const data = { headers: response.headers(), method: request.method(), resourceType: request.resourceType(), status: response.status(), url: response.url() };
    if (isIntentionalEventSourceDisableResponse(data, page.url())) runtime.intentionalEventSourceTeardowns.add(normalizeUrl(data.url));
    if (isCompletedQualifiedViewResponse(data, page.url())) runtime.completedQualifiedViewWrites.add(normalizeUrl(data.url));
    if (data.status >= 400) runtime.issues.push({ kind: "http", status: data.status, resourceType: data.resourceType, url: data.url });
  });
  page.on("requestfailed", request => runtime.issues.push({ kind: "requestfailed", message: request.failure()?.errorText ?? "unknown", resourceType: request.resourceType(), url: request.url() }));
  return runtime;
}
async function open(page: Page, query: string) {
  await page.goto(`/app/tasks${query}`, { waitUntil: "load" });
  await expect(page.getByRole("heading", { name: "Tasks", level: 1, exact: true })).toBeVisible();
  await page.waitForTimeout(300); // Match the registered fixture's post-hydration media switch.
  await page.emulateMedia({ reducedMotion: "reduce" });
  const opener = page.locator('article[data-id][aria-label]').first();
  await expect(opener).toHaveAttribute("aria-label", taskName);
  await opener.focus();
  await expect(opener).toBeFocused();
  await page.keyboard.press("Enter");
  const panel = page.getByRole("dialog", { name: taskName, exact: true });
  await expect(panel).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  return { panel, opener };
}
async function fresh(browser: Browser, viewport: { width: number; height: number }) {
  const context = await browser.newContext({ baseURL: "http://127.0.0.1:4353", viewport,
    locale: contract.determinism.locale, timezoneId: contract.determinism.timezoneId,
    colorScheme: contract.determinism.colorScheme });
  const page = await context.newPage();
  const runtime = watchRuntime(page);
  return { context, page, runtime };
}
async function state(page: Page, panel: Locator) {
  const taskId = new URL(page.url()).searchParams.get("task");
  const title = await panel.getByRole("textbox", { name: "Task title", exact: true }).inputValue();
  const notes = await panel.getByRole("region", { name: "Notes", exact: true }).getByRole("button").last().textContent();
  const properties = await panel.locator("dl").evaluate(dl => Object.fromEntries(
    [...dl.querySelectorAll("dt")].map(dt => [dt.textContent?.trim(), dt.nextElementSibling?.textContent?.trim()]),
  ));
  expect(taskId).toBeTruthy();
  expect(title).toBe(taskName);
  return { taskId, title, notes: notes?.trim() ?? "", properties };
}
async function geometry(panel: Locator) {
  return panel.evaluate(node => {
    const props = node.querySelector("dl")!;
    // Section identity comes from the actual heading, including reused sections;
    // hashed CSS names and task-specific heading IDs are not the selector contract.
    const notes = [...node.querySelectorAll("h2")].find(heading => heading.textContent?.trim() === "Notes")!.closest("section")!;
    const children = [...props.parentElement!.children];
    const divider = children.find((el, index) => index > children.indexOf(props) && el.tagName === "DIV" && el.childElementCount === 0 && !el.textContent?.trim())!;
    const rect = (el: Element) => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, height: r.height }; };
    const style = getComputedStyle(divider);
    const notesStyle = getComputedStyle(notes);
    return { properties: rect(props), notes: rect(notes), divider: rect(divider), dividerBackground: style.backgroundColor,
      notesTopBorder: { width: Number.parseFloat(notesStyle.borderTopWidth), style: notesStyle.borderTopStyle, color: notesStyle.borderTopColor },
      propertyIndex: children.indexOf(props), notesIndex: children.indexOf(notes), dividerIndex: children.indexOf(divider),
      dividerDirectChild: divider.parentElement === props.parentElement, dividerEmpty: !divider.textContent?.trim(),
      notesImmediatelyAfterDivider: notes.previousElementSibling === divider };
  });
}
async function overflow(page: Page, panel: Locator) {
  return { document: await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
    panel: await panel.evaluate(node => Math.max(node.scrollWidth - node.clientWidth,
      ...[...node.querySelectorAll<HTMLElement>("[data-panel-composition], dl, section")].map(el => el.scrollWidth - el.clientWidth))) };
}
async function check(item: Case, name: string, action: () => Promise<void>) {
  const target = item.checks.find(entry => entry.name === name)!;
  try { await action(); target.passed = true; delete target.failure; }
  catch (error) { target.failure = error instanceof Error ? error.message : String(error); throw error; }
}

test("tasks detail workshop / equal-state comparison and interactions", async ({ browser }, testInfo) => {
  const cases: Case[] = contract.projects.flatMap((project: { name: string }) => variants.map(variant => ({
    variant, viewport: project.name, passed: false, initialCaptureBeforeEditing: false, initialStateDigest: null,
    checks: checkNames.map(name => ({ name, passed: false, failure: "not observed" })), failure: null, metrics: {},
  })));
  const failures: string[] = [];
  let captured = 0;
  try {
    // Phase one: ALL eight screenshots and actual DOM readbacks, with no mutation.
    for (const item of cases) {
      const project = contract.projects.find((entry: { name: string }) => entry.name === item.viewport);
      const { context, page, runtime } = await fresh(browser, project.viewport);
      try {
        const { panel } = await open(page, `?panelComposition=${item.variant}`);
        await expect(panel.locator("[data-panel-composition]")).toHaveAttribute("data-panel-composition", item.variant);
        item.initialState = await state(page, panel);
        item.initialStateDigest = digest(item.initialState);
        const png = await page.screenshot({ animations: "disabled", caret: "hide", fullPage: true });
        await testInfo.attach(`task-detail-${item.variant}-${item.viewport}.png`, { body: png, contentType: "image/png" });
        item.initialCaptureBeforeEditing = true;
        captured += 1;
        await check(item, "section-order", async () => {
          const g = await geometry(panel); item.metrics.initialGeometry = g;
          expect(g.dividerDirectChild && g.dividerEmpty).toBe(true);
          // The modal's divider node is a spacer. Notes draws the real hairline,
          // so prove its computed border and physical location, not spacer height.
          expect(g.notesTopBorder.width).toBeGreaterThanOrEqual(1);
          expect(g.notesTopBorder.style).not.toBe("none");
          expect(g.notesTopBorder.style).not.toBe("hidden");
          expect(g.notesTopBorder.color).not.toBe("rgba(0, 0, 0, 0)");
          if (item.variant === "record-first") {
            expect(g.propertyIndex).toBeLessThan(g.dividerIndex);
            expect(g.dividerIndex).toBeLessThan(g.notesIndex);
            expect(g.notesImmediatelyAfterDivider).toBe(true);
            expect(g.properties.bottom).toBeLessThanOrEqual(g.divider.top + 1);
            expect(g.divider.bottom).toBeLessThanOrEqual(g.notes.top + 1);
          } else {
            expect(g.notesIndex).toBeLessThan(g.propertyIndex);
            expect(g.propertyIndex).toBeLessThan(g.dividerIndex);
            expect(g.notes.bottom).toBeLessThanOrEqual(g.properties.top + 1);
          }
        });
        await check(item, "original-controls", async () => {
          for (const name of ["Notes", "Subtasks", "Files and links", "Activity"]) await expect(panel.getByRole("heading", { name, exact: true })).toBeVisible();
          for (const label of ["Status", "Assignees", "Due date", "Priority", "Tags"]) await expect(panel.locator("dt").filter({ hasText: new RegExp(`^${label}$`) })).toHaveCount(1);
          for (const name of ["Edit", "Open", "Close", "Previous task (K)", "Next task (J)", "More actions"]) await expect(panel.getByRole("button", { name, exact: true })).toBeEnabled();
          await expect(panel.getByRole("button", { name: "See all", exact: true }).first()).toBeEnabled();
          await expect(panel.getByRole("textbox", { name: "Task title", exact: true })).toBeEnabled();
          await expect(panel.getByRole("region", { name: "Notes", exact: true }).getByRole("button").last()).toBeEnabled();
          await expect(panel.getByRole("textbox", { name: "Add subtask", exact: true })).toBeEnabled();
          await expect(panel.getByRole("button", { name: "Attach a file", exact: true })).toBeEnabled();
          item.metrics.originalControls = await panel.evaluate(node => [...node.querySelectorAll<HTMLElement>("button, input, textarea, [role=button]")].map(el => ({
            tag: el.tagName, name: el.getAttribute("aria-label") ?? el.textContent?.trim() ?? "",
            disabled: el.hasAttribute("disabled"),
          })));
        });
        await check(item, "initial-axe", async () => {
          const axe = await new AxeBuilder({ page }).analyze();
          const blocking = axe.violations.filter(v => v.impact === "critical" || v.impact === "serious");
          item.metrics.initialAxe = { blocking, violationCount: axe.violations.length };
          expect(blocking).toEqual([]);
        });
        await check(item, "initial-overflow", async () => {
          const measured = await overflow(page, panel); item.metrics.initialOverflow = measured;
          expect(measured.document).toBeLessThanOrEqual(1); expect(measured.panel).toBeLessThanOrEqual(1);
        });
        const errors = runtimeFailures(runtime, null, page.url());
        item.metrics.initialRuntime = { issues: runtime.issues, failures: errors };
        expect(errors).toEqual([]);
      } catch (error) {
        item.failure = `Initial capture/audit: ${error instanceof Error ? error.message : String(error)}`;
        failures.push(`${item.variant}/${item.viewport}: ${item.failure}`);
      } finally { await context.close(); }
    }
    // Do not edit anything unless all initial states were actually captured.
    if (captured !== 8 || cases.some(item => item.failure)) throw new Error("The eight initial capture/audit cases did not all complete; editing phase was not started.");
    for (const project of contract.projects) {
      const pair = cases.filter(item => item.viewport === project.name);
      expect(pair[0].initialStateDigest).toBe(pair[1].initialStateDigest);
    }
    // Phase two: fresh context for each case, matched to its untouched readback.
    for (const item of cases) {
      const project = contract.projects.find((entry: { name: string }) => entry.name === item.viewport);
      const { context, page, runtime } = await fresh(browser, project.viewport);
      try {
        let { panel, opener } = await open(page, `?panelComposition=${item.variant}`);
        expect(digest(await state(page, panel))).toBe(item.initialStateDigest);
        await check(item, "keyboard-open-close-focus", async () => {
          await page.keyboard.press("Escape"); await expect(panel).toHaveCount(0); await expect(opener).toBeFocused();
          expect(new URL(page.url()).searchParams.get("panelComposition")).toBe(item.variant);
          await page.keyboard.press("Enter"); panel = page.getByRole("dialog", { name: taskName, exact: true }); await expect(panel).toBeVisible();
        });
        const priority = panel.locator("dl > div").filter({ has: page.locator("dt").filter({ hasText: /^Priority$/ }) }).getByRole("button");
        await check(item, "popover-escape", async () => {
          await priority.click(); const popover = page.getByRole("dialog", { name: "Priority", exact: true });
          await expect(popover).toBeVisible(); await page.keyboard.press("Escape");
          await expect(popover).toHaveCount(0); await expect(panel).toBeVisible(); await expect(priority).toBeFocused();
        });
        await check(item, "expand-baseline", async () => {
          // Both entry controls must retain the shared page composition.
          for (const button of ["Open", "See all"]) {
            await panel.getByRole("button", { name: button, exact: true }).first().click();
            await expect(panel.locator("dl[data-grid]")).toHaveCount(1);
            await expect(panel.locator("[data-panel-composition]")).toHaveCount(0);
            const baseline = await panel.evaluate(node => {
              const dl = node.querySelector("dl[data-grid]")!;
              const description = node.querySelector('section[aria-label="Description"]')!;
              const children = [...dl.parentElement!.children];
              const divider = children.find((el, index) => index > children.indexOf(dl) && el.tagName === "DIV" && el.childElementCount === 0 && !el.textContent?.trim())!;
              return { props: children.indexOf(dl), divider: children.indexOf(divider), description: children.indexOf(description), height: divider.getBoundingClientRect().height };
            });
            expect(baseline.props).toBeLessThan(baseline.divider); expect(baseline.divider).toBeLessThan(baseline.description); expect(baseline.height).toBeGreaterThanOrEqual(1);
            item.metrics.expandedBaseline = baseline;
            await panel.getByRole("button", { name: "Back to the panel (E)", exact: true }).click();
            await expect(panel.locator("[data-panel-composition]")).toHaveAttribute("data-panel-composition", item.variant);
          }
        });
        await check(item, "navigation-selector", async () => {
          const id = new URL(page.url()).searchParams.get("task");
          await panel.getByRole("button", { name: "Next task (J)", exact: true }).click();
          await expect.poll(() => new URL(page.url()).searchParams.get("task")).not.toBe(id);
          expect(new URL(page.url()).searchParams.get("panelComposition")).toBe(item.variant);
          const next = page.locator("[data-task-detail-panel]");
          await next.getByRole("button", { name: "Previous task (K)", exact: true }).click();
          await expect.poll(() => new URL(page.url()).searchParams.get("task")).toBe(id);
          await expect(panel).toBeVisible();
        });
        await check(item, "title-edit", async () => {
          const edited = `${taskName} — workshop readback`;
          await panel.getByRole("textbox", { name: "Task title", exact: true }).fill(edited);
          await panel.getByRole("textbox", { name: "Task title", exact: true }).press("Enter");
          panel = page.getByRole("dialog", { name: edited, exact: true }); await expect(panel).toBeVisible();
          await panel.getByRole("button", { name: "Close", exact: true }).click();
          opener = page.locator('article[data-id][aria-label]').filter({ hasText: edited }).first();
          await expect(opener).toHaveAttribute("aria-label", edited); await opener.focus(); await page.keyboard.press("Enter");
          await expect(panel.getByRole("textbox", { name: "Task title", exact: true })).toHaveValue(edited);
          item.metrics.titleReadback = edited;
        });
        await check(item, "priority-edit", async () => {
          const field = panel.locator("dl > div").filter({ has: page.locator("dt").filter({ hasText: /^Priority$/ }) }).getByRole("button");
          const before = (await field.textContent())?.trim(); await field.click();
          const popover = page.getByRole("dialog", { name: "Priority", exact: true });
          const option = popover.getByRole("option", { selected: false }).first(); const after = (await option.textContent())?.trim();
          expect(after).toBeTruthy(); expect(after).not.toBe(before); await option.click();
          await expect(field).toHaveText(after!); item.metrics.priorityReadback = { before, after };
        });
        const longNotes = Array.from({ length: 24 }, (_, index) => `Workshop note ${index + 1}: Confirm the delivery plan, arrival time and named contact with the hire company before the final event briefing.`).join("\n");
        await check(item, "notes-edit", async () => {
          const notes = panel.getByRole("region", { name: "Notes", exact: true });
          await notes.getByRole("button").last().click();
          await notes.getByRole("textbox", { name: "Task description", exact: true }).fill(longNotes);
          await panel.getByRole("textbox", { name: "Task title", exact: true }).focus();
          await expect(notes.getByRole("button").last()).toHaveText(longNotes);
          // Reopen the editor to read the actual updated in-memory task description.
          await notes.getByRole("button").last().click();
          await expect(notes.getByRole("textbox", { name: "Task description", exact: true })).toHaveValue(longNotes);
          await panel.getByRole("textbox", { name: "Task title", exact: true }).focus();
          item.metrics.notesReadback = { characters: longNotes.length, lines: 24, sha256: digest(longNotes), persistence: "not-exercised" };
        });
        await check(item, "long-content", async () => {
          const measured = await overflow(page, panel);
          const scroll = panel.locator("[data-panel-composition] > div").last();
          const dimensions = await scroll.evaluate(el => ({ clientHeight: el.clientHeight, scrollHeight: el.scrollHeight }));
          expect(dimensions.scrollHeight).toBeGreaterThan(dimensions.clientHeight);
          await scroll.evaluate(el => { el.scrollTop = el.scrollHeight; });
          await expect.poll(() => scroll.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
          const travel = await scroll.evaluate(el => ({ scrollTop: el.scrollTop, remaining: el.scrollHeight - el.clientHeight - el.scrollTop }));
          expect(travel.remaining).toBeLessThanOrEqual(1); expect(measured.document).toBeLessThanOrEqual(1); expect(measured.panel).toBeLessThanOrEqual(1);
          item.metrics.longContent = { ...measured, ...dimensions, ...travel };
        });
        await check(item, "invalid-selector-default", async () => {
          const observations = [];
          for (const query of ["", "?panelComposition=unknown", "?panelComposition=context-first&panelComposition=record-first"]) {
            const opened = await open(page, query);
            await expect(opened.panel.locator("[data-panel-composition]")).toHaveAttribute("data-panel-composition", "record-first");
            const g = await geometry(opened.panel); expect(g.notesImmediatelyAfterDivider).toBe(true);
            observations.push({ query, composition: "record-first", geometry: g });
            await page.keyboard.press("Escape"); await expect(opened.panel).toHaveCount(0); await expect(opened.opener).toBeFocused();
          }
          item.metrics.selectorDefaults = observations;
        });
      } catch (error) {
        item.failure = `Interaction: ${error instanceof Error ? error.message : String(error)}`;
        failures.push(`${item.variant}/${item.viewport}: ${item.failure}`);
      } finally {
        try {
          await check(item, "runtime", async () => {
            const errors = runtimeFailures(runtime, null, page.url()); item.metrics.runtime = { issues: runtime.issues, failures: errors }; expect(errors).toEqual([]);
          });
        } catch (error) { item.failure ??= String(error); failures.push(`${item.variant}/${item.viewport}: runtime failure`); }
        item.passed = item.failure === null && item.checks.every(entry => entry.passed);
        await context.close();
      }
    }
  } catch (error) { failures.push(error instanceof Error ? error.message : String(error)); }
  finally {
    await testInfo.attach("qualification.json", { body: Buffer.from(JSON.stringify({
      failure: failures.length ? failures.join("\n") : null, cases,
      initialCaptureCount: captured, allInitialCapturesBeforeEditing: captured === 8,
      browserVersion: browser.version(),
    }, null, 2)), contentType: "application/json" });
  }
  expect(failures, "Retained workshop qualification failures").toEqual([]);
  expect(cases.every(item => item.passed)).toBe(true);
});
