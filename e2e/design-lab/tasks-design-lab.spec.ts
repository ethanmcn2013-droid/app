import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const options = ["a", "b", "c"] as const;
const views = ["board", "list", "timeline", "calendar"] as const;

function labUrl({
  option = "a",
  view = "board",
  dataset = "normal",
  mode = "default",
  task,
}: {
  option?: string;
  view?: string;
  dataset?: string;
  mode?: string;
  task?: string;
} = {}) {
  const params = new URLSearchParams({ option, view, dataset, density: "compact", mode });
  if (task) params.set("task", task);
  return `/__design-lab/tasks?${params.toString()}`;
}

async function settle(page: Page) {
  await page.locator('[data-option]').waitFor({ state: "visible" });
  await page.locator('[data-hydrated="true"]').waitFor({ state: "attached" });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
}

test.describe("route and capability parity", () => {
  for (const option of options) {
    for (const view of views) {
      test(`${option.toUpperCase()} ${view} opens without runtime errors`, async ({ page }) => {
        const consoleErrors: string[] = [];
        const pageErrors: string[] = [];
        page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
        page.on("pageerror", (error) => pageErrors.push(error.message));
        await page.goto(labUrl({ option, view }));
        await settle(page);
        await expect(page.getByText("Tasks design lab", { exact: true })).toBeVisible();
        await expect(page.locator(`[data-option="${option}"]`)).toBeVisible();
        await expect(page.locator(`[data-view="${view}"]`)).toBeVisible();
        await expect(page.getByText("Local lab · session-only · reload resets", { exact: true })).toBeVisible();
        expect(pageErrors).toEqual([]);
        expect(consoleErrors).toEqual([]);
      });
    }
  }

  test("invalid query values fail safely to documented defaults", async ({ page }) => {
    await page.goto(labUrl({ option: "z", view: "chart", dataset: "huge", mode: "broken" }));
    await settle(page);
    await expect(page.locator('[data-option="a"]')).toBeVisible();
    await expect(page.locator('[data-view="board"]')).toBeVisible();
  });

  test("A/B/C expose the same 40-task normal fixture", async ({ page }) => {
    const counts: number[] = [];
    for (const option of options) {
      await page.goto(labUrl({ option, view: "board" }));
      await settle(page);
      counts.push(Number(await page.locator('[data-task-count]').getAttribute("data-task-count")));
    }
    expect(counts).toEqual([40, 40, 40]);
  });

  for (const option of options) {
    test(`${option.toUpperCase()} exposes empty, loading, error, and read-only state contracts`, async ({ page }) => {
      await page.goto(labUrl({ option, view: "board", mode: "empty" }));
      await settle(page);
      await expect(page.locator('[data-task-count="0"]')).toBeVisible();
      await expect(page.locator('[data-work-surface="true"] [data-task-id]')).toHaveCount(0);

      await page.goto(labUrl({ option, view: "board", mode: "loading" }));
      await settle(page);
      await expect(page.getByLabel("Loading design-lab state")).toBeVisible();
      await expect(page.locator(`[data-option="${option}"]`)).toBeVisible();

      await page.goto(labUrl({ option, view: "board", mode: "error" }));
      await settle(page);
      await expect(page.getByRole("alert").filter({ hasText: "Workspace tasks could not be loaded" })).toBeVisible();
      await page.getByRole("button", { name: "Retry fixture" }).click();
      await expect(page.getByLabel("State mode")).toHaveValue("default");

      await page.goto(labUrl({ option, view: "list", mode: "readonly", task: "launch-13" }));
      await settle(page);
      await expect(page.getByRole("complementary", { name: /launch-13/ }).getByText("Read-only", { exact: true })).toBeVisible();
      await expect(page.getByLabel("Task title")).toBeDisabled();
    });
  }
});

test.describe("canonical state and inspector", () => {
  test("shared inspector changes status, assignee, and explicit due date in one model", async ({ page }) => {
    await page.goto(labUrl({ option: "a", view: "board", task: "launch-01" }));
    await settle(page);
    const inspector = page.getByRole("complementary", { name: /launch-01/ });
    await inspector.getByRole("combobox", { name: "Status", exact: true }).selectOption("active");
    await inspector.getByRole("checkbox", { name: /Imani Brooks/ }).check();
    await inspector.getByRole("combobox", { name: "Schedule", exact: true }).selectOption("due");
    await inspector.getByLabel("Due", { exact: true }).fill("2026-07-24");

    await page.getByRole("button", { name: "List", exact: true }).click();
    await page.getByRole("button", { name: /B\s*Editorial Project Room/ }).click();
    await expect(page.locator('[data-option="b"]')).toBeVisible();
    await expect(page.locator('[data-view="list"]')).toBeVisible();
    const persistedInspector = page.getByRole("complementary", { name: /launch-01/ });
    await expect(persistedInspector.getByRole("combobox", { name: "Status", exact: true })).toHaveValue("active");
    await expect(persistedInspector.getByRole("checkbox", { name: /Imani Brooks/ })).toBeChecked();
    await expect(persistedInspector.getByLabel("Due", { exact: true })).toHaveValue("2026-07-24");
  });

  test("Board drag moves a card and List receives the same status", async ({ page }) => {
    await page.goto(labUrl({ option: "a", view: "board" }));
    await settle(page);
    const source = page.locator('[data-view="board"] article[data-task-id="launch-01"]');
    const target = page.locator('[data-view="board"] section[data-status="active"]');
    await source.dragTo(target);
    await expect(target.locator('article[data-task-id="launch-01"]')).toBeVisible();

    await page.getByRole("button", { name: "List", exact: true }).click();
    const row = page.locator('[data-view="list"] tr[data-task-id="launch-01"]');
    await expect(row.getByRole("combobox", { name: /Status for Finalize launch positioning/ })).toHaveValue("active");
  });

  test("multi-select exposes bulk actions and completes selected tasks", async ({ page }) => {
    await page.goto(labUrl({ option: "a", view: "list" }));
    await settle(page);
    await page.getByRole("checkbox", { name: "Select Finalize launch positioning" }).check();
    await page.getByRole("checkbox", { name: "Select Approve onboarding copy" }).check();
    const bulk = page.getByRole("toolbar", { name: "Bulk actions" });
    await expect(bulk.getByText("2 selected", { exact: true })).toBeVisible();
    await bulk.getByRole("button", { name: "Complete", exact: true }).click();
    await expect(page.locator('tr[data-task-id="launch-01"]')).toHaveAttribute("data-completed", "true");
    await expect(page.locator('tr[data-task-id="launch-02"]')).toHaveAttribute("data-completed", "true");
    await page.getByRole("button", { name: "Board", exact: true }).click();
    await expect(page.locator('section[data-status="done"] article[data-task-id="launch-01"]')).toBeVisible();
    await expect(page.locator('section[data-status="done"] article[data-task-id="launch-02"]')).toBeVisible();
  });

  test("Timeline and Calendar operations preserve schedule and completion across all views", async ({ page }) => {
    await page.goto(labUrl({ option: "a", view: "timeline", dataset: "dense" }));
    await settle(page);

    const unscheduled = page.locator('[data-unscheduled-task-id="launch-14"]');
    await unscheduled.getByRole("button", { name: "QA subscription upgrade flow", exact: true }).click();
    const dateForm = page.getByRole("form", { name: /Timeline dates for QA subscription upgrade flow/ });
    await dateForm.getByLabel("Schedule QA subscription upgrade flow on").fill("2026-07-24");
    await dateForm.getByRole("button", { name: "Schedule", exact: true }).click();
    await expect(page.locator('[data-unscheduled-task-id="launch-14"]')).toHaveCount(0);
    await expect(page.locator('[data-scheduled-task-id="launch-14"]').first()).toBeVisible();

    const range = page.locator('[data-scheduled-task-id="launch-13"]');
    const rangeButton = range.getByRole("button", { name: /Review homepage motion prototype.*Alt plus arrows/i });
    await rangeButton.focus();
    await page.keyboard.press("Alt+Shift+ArrowRight");
    await expect(page.getByRole("textbox", { name: "End date for Review homepage motion prototype" })).toHaveValue("2026-07-23");

    await page.getByRole("button", { name: "Calendar", exact: true }).click();
    const crowdedDay = page.locator('td[data-date="2026-07-22"]');
    const more = crowdedDay.getByRole("button", { name: /\+\d+ more/ });
    await more.click();
    await expect(page.getByRole("dialog", { name: /More tasks on/ })).toBeVisible();
    await page.getByRole("button", { name: "Close more tasks" }).click();

    const destination = page.locator('td[data-date="2026-07-23"]');
    await crowdedDay.locator('[data-scheduled-task-id="launch-03"]').dragTo(destination);
    const movedTask = destination.locator('[data-scheduled-task-id="launch-03"]');
    await expect(movedTask).toBeVisible();
    await movedTask.click({ button: "right" });
    await page.getByRole("menu").getByRole("menuitem", { name: "Complete", exact: true }).click();
    await expect(movedTask).toHaveAttribute("data-completed", "true");
    await movedTask.click();

    for (const view of views) {
      await page.getByRole("button", { name: view[0].toUpperCase() + view.slice(1), exact: true }).click();
      await expect(page.locator(`[data-view="${view}"]`)).toBeVisible();
      await expect(page.locator('[data-task-id="launch-03"]').first()).toBeAttached();
      const inspector = page.getByRole("complementary", { name: /launch-03/ });
      await expect(inspector.getByRole("combobox", { name: "Status", exact: true })).toHaveValue("done");
      await expect(inspector.getByLabel("Due", { exact: true })).toHaveValue("2026-07-23");
    }
  });

  test("keyboard navigation and reduced-motion behavior remain available", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(labUrl({ option: "a", view: "board" }));
    await settle(page);
    const firstCard = page.locator('article[data-task-id="launch-01"]');
    await firstCard.focus();
    await page.keyboard.press("ArrowDown");
    await expect(page.locator('article[data-task-id="launch-02"]')).toBeFocused();

    await page.getByRole("button", { name: "Calendar", exact: true }).click();
    const today = page.locator('button[data-date-button="2026-07-16"]');
    await today.focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.locator('button[data-date-button="2026-07-17"]')).toBeFocused();

    await page.getByRole("button", { name: /B\s*Editorial Project Room/ }).click();
    await page.getByRole("button", { name: "Board", exact: true }).click();
    const motion = await page.locator('[data-option="b"] [data-task-id="launch-01"]').first().evaluate((element) => ({
      reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
      transitionDuration: getComputedStyle(element).transitionDuration,
    }));
    expect(motion.reduced).toBe(true);
    expect(Number.parseFloat(motion.transitionDuration)).toBeLessThanOrEqual(0.001);
  });

  test("one inspector edit survives view and option switches without a request", async ({ page }) => {
    const writes: string[] = [];
    page.on("request", (request) => { if (request.method() !== "GET") writes.push(`${request.method()} ${request.url()}`); });
    await page.goto(labUrl({ option: "a", view: "board", task: "launch-13" }));
    await settle(page);
    const title = page.getByLabel("Task title");
    await expect(title).toHaveValue("Review homepage motion prototype");
    await title.fill("Review homepage motion prototype — approved");
    await title.press("Enter");
    await page.getByRole("button", { name: "List", exact: true }).click();
    await expect(page.locator('[data-view="list"]')).toBeVisible();
    await expect(page.getByText("Review homepage motion prototype — approved", { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: /B\s*Editorial Project Room/ }).click();
    await expect(page.locator('[data-option="b"]')).toBeVisible();
    await expect(page.getByText("Review homepage motion prototype — approved", { exact: true }).first()).toBeVisible();
    expect(writes).toEqual([]);
  });

  test("an explicit schedule round-trip updates geometry and returns to the tray", async ({ page }) => {
    await page.goto(labUrl({ option: "c", view: "timeline", dataset: "dense", task: "launch-01" }));
    await settle(page);
    const inspector = page.getByRole("complementary", { name: /launch-01/ });
    await expect(page.locator('[data-unscheduled-task-id="launch-01"]').first()).toBeVisible();
    await expect(page.locator('[data-scheduled-task-id="launch-01"]')).toHaveCount(0);
    await inspector.getByRole("combobox", { name: "Schedule", exact: true }).selectOption("range");
    await expect(page.locator('[data-scheduled-task-id="launch-01"]').first()).toBeVisible();
    await expect(page.locator('[data-unscheduled-task-id="launch-01"]')).toHaveCount(0);
    await inspector.getByRole("combobox", { name: "Schedule", exact: true }).selectOption("unscheduled");
    await expect(page.locator('[data-unscheduled-task-id="launch-01"]').first()).toBeVisible();
    await expect(page.locator('[data-scheduled-task-id="launch-01"]')).toHaveCount(0);
  });

  for (const option of options) {
    for (const view of ["timeline", "calendar"] as const) {
      test(`${option.toUpperCase()} ${view} never gives an undated task geometry`, async ({ page }) => {
        await page.goto(labUrl({ option, view, dataset: "dense" }));
        await settle(page);
        await expect(page.locator('[data-unscheduled-task-id="launch-01"]').first()).toBeVisible();
        await expect(page.locator('[data-scheduled-task-id="launch-01"]')).toHaveCount(0);
      });
    }
  }

  test("read-only mode disables the shared inspector mutation surface", async ({ page }) => {
    await page.goto(labUrl({ option: "b", view: "list", mode: "readonly", task: "launch-13" }));
    await settle(page);
    const inspector = page.getByRole("complementary", { name: /launch-13/ });
    await expect(inspector.getByText("Read-only", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Task title")).toBeDisabled();
    await expect(page.getByLabel("Task description")).toBeDisabled();
    await expect(inspector.getByRole("combobox", { name: "Schedule", exact: true })).toBeDisabled();
  });

  test("full-screen task mode contains focus and restores it when docked", async ({ page }) => {
    await page.goto(labUrl({ option: "a", view: "list", task: "launch-13" }));
    await settle(page);
    await page.getByRole("button", { name: "Open full-screen task mode" }).click();
    const dialog = page.getByRole("dialog", { name: /launch-13/ });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("complementary", { name: /launch-13/ })).toBeVisible();
  });

  test("command palette opens from the global shortcut", async ({ page }) => {
    await page.goto(labUrl());
    await settle(page);
    await page.keyboard.press("Control+p");
    await expect(page.getByRole("dialog", { name: "Task command palette" })).toBeVisible();
    await page.getByLabel("Search tasks and commands").fill("migration guide");
    const palette = page.getByRole("dialog", { name: "Task command palette" });
    await expect(palette.getByRole("button", { name: /Prepare customer migration guide/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Task command palette" })).toHaveCount(0);
  });
});

test.describe("accessibility evidence", () => {
  for (const option of options) {
    for (const view of views) {
      test(`${option.toUpperCase()} ${view} has no serious axe findings`, async ({ page }) => {
        await page.goto(labUrl({ option, view, dataset: "normal" }));
        await settle(page);
        const focusTarget = page.locator('[data-work-surface="true"] button[data-task-id], [data-work-surface="true"] [data-task-id][tabindex="0"]').first();
        await focusTarget.focus();
        await page.keyboard.press("Tab");
        await page.keyboard.press("Shift+Tab");
        await expect(focusTarget).toBeFocused();
        const focusIndicator = await focusTarget.evaluate((element) => [element, ...element.querySelectorAll<HTMLElement>(":scope > th, :scope > td")].some((candidate) => {
          const style = getComputedStyle(candidate);
          return Number.parseFloat(style.outlineWidth) >= 2 && style.outlineStyle !== "none"
            || style.boxShadow !== "none";
        }));
        expect(focusIndicator, `${option}/${view} focused task has no visible indicator`).toBe(true);
        const result = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
          .analyze();
        const axeDirectory = path.resolve("artifacts/tasks-redesign/axe");
        await mkdir(axeDirectory, { recursive: true });
        await writeFile(path.join(axeDirectory, `${option}-${view}.json`), JSON.stringify(result, null, 2));
        const blocking = result.violations.filter((violation) => violation.impact === "critical" || violation.impact === "serious");
        expect(blocking.map((violation) => ({
          id: violation.id,
          impact: violation.impact,
          targets: violation.nodes.map((node) => node.target.join(" > ")),
        }))).toEqual([]);
      });
    }
  }
});

test.describe("Option B navigation shell", () => {
  test("wide desktop shows the Signal product rail and the Projects sidebar", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(labUrl({ option: "b" }));
    await settle(page);

    const rail = page.locator("[data-signal-product-rail]");
    const sidebar = page.locator("[data-projects-sidebar]");
    await expect(rail).toBeVisible();
    await expect(sidebar).toBeVisible();

    const heading = sidebar.getByRole("heading", { name: "Projects", exact: true });
    await expect(heading).toBeVisible();
    await expect(heading).toHaveText("Projects");

    const optionB = page.locator('[data-option="b"]');
    await expect(optionB.getByText("Spaces", { exact: true })).toHaveCount(0);
    await expect(optionB.getByText("Workspaces", { exact: true })).toHaveCount(0);

    for (const label of ["Notes", "Tasks", "Timeline", "Signal", "More"]) {
      await expect(rail.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(rail.locator('[data-product="tasks"]')).toHaveAttribute("aria-current", "page");
    await expect(rail.locator("[aria-current='page']")).toHaveCount(1);

    await expect(sidebar.getByRole("button", { name: /Public launch/ })).toHaveAttribute("aria-expanded", "true");
    await expect(sidebar.locator('[data-project-row="launch-workspace"]')).toHaveAttribute("aria-current", "page");

    const documentOverflows = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(documentOverflows).toBe(false);
  });

  test("Projects disclosure, sidebar collapse, and rail search are fully operable", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(labUrl({ option: "b" }));
    await settle(page);

    const sidebar = page.locator("[data-projects-sidebar]");
    const publicLaunch = sidebar.getByRole("button", { name: /Public launch/ });
    const launchWorkspace = sidebar.locator('[data-project-row="launch-workspace"]');
    await expect(launchWorkspace).toBeVisible();
    await publicLaunch.click();
    await expect(publicLaunch).toHaveAttribute("aria-expanded", "false");
    await expect(launchWorkspace).toBeHidden();
    await publicLaunch.focus();
    await page.keyboard.press("Enter");
    await expect(publicLaunch).toHaveAttribute("aria-expanded", "true");
    await expect(launchWorkspace).toBeVisible();

    const tasksButton = page.locator("[data-signal-product-rail] [data-product='tasks']");
    await tasksButton.focus();
    const outline = await tasksButton.evaluate((element) => {
      const style = getComputedStyle(element);
      return { width: Number.parseFloat(style.outlineWidth), style: style.outlineStyle };
    });
    expect(outline.width).toBeGreaterThanOrEqual(2);
    expect(outline.style).not.toBe("none");

    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page.locator('[data-option="b"] input[aria-label="Search this view"]')).toBeFocused();

    await page.getByRole("button", { name: "Collapse Projects sidebar" }).click();
    await expect(page.locator("[data-projects-sidebar]")).toHaveCount(0);
    const expand = page.getByRole("button", { name: "Expand Projects sidebar" });
    await expect(expand).toBeFocused();
    await expand.click();
    await expect(page.locator("[data-projects-sidebar]")).toBeVisible();
    await expect(page.getByRole("button", { name: "Collapse Projects sidebar" })).toBeFocused();
  });

  test("narrow widths swap the sidebar for an accessible Projects drawer", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 1000 });
    await page.goto(labUrl({ option: "b" }));
    await settle(page);

    await expect(page.locator("[data-projects-sidebar]")).toHaveCount(0);
    const trigger = page.getByRole("button", { name: "Open Projects" });
    await expect(trigger).toBeVisible();
    await trigger.click();

    const drawer = page.getByRole("dialog", { name: "Tasks projects" });
    await expect(drawer).toBeVisible();
    await expect(page.locator("[data-projects-drawer]")).toBeVisible();
    await expect(drawer.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
    const box = await drawer.boundingBox();
    expect(box, "drawer bounding box").not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(52);

    const documentOverflows = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(documentOverflows).toBe(false);

    await page.keyboard.press("Escape");
    await expect(page.locator("[data-projects-drawer]")).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("reduced motion strips the shell's transitions", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(labUrl({ option: "b" }));
    await settle(page);
    const durations = await page.locator("[data-signal-product-rail] [data-product='tasks'] span").first().evaluate((element) => getComputedStyle(element).transitionDuration);
    for (const duration of durations.split(",")) {
      expect(Number.parseFloat(duration)).toBeLessThanOrEqual(0.001);
    }
  });

  test("Options A, C, and the hybrid keep the shared workspace rail", async ({ page }) => {
    for (const option of ["a", "c", "hybrid"]) {
      await page.goto(labUrl({ option }));
      await settle(page);
      await expect(page.locator("[data-signal-product-rail]")).toHaveCount(0);
      await expect(page.locator("[data-projects-sidebar]")).toHaveCount(0);
      await expect(page.getByRole("complementary", { name: "Workspace navigation" })).toHaveCount(option === "c" ? 0 : 1);
    }
  });

  test("the shell persists across all four Option B views", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    for (const view of views) {
      await page.goto(labUrl({ option: "b", view }));
      await settle(page);
      await expect(page.locator("[data-signal-product-rail]")).toBeVisible();
      await expect(page.locator("[data-projects-sidebar]")).toBeVisible();
      await expect(page.locator(`[data-view="${view}"]`)).toBeVisible();
    }
  });
});
