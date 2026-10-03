import { expect, test, type Page } from "@playwright/test";

// v3: Timeline opens on the chosen project's plan under two tabs, "All
// projects" (the portfolio Gantt) and the project itself. The chevron beside
// the project tab ("Switch project") opens a roving-focus menu of every
// project. This spec guards switching through it, browser history, reload,
// the keyboard path and the phone layout.

const PLAN = (slug: string) =>
  new RegExp(`/app/timeline/${slug}\\?workspaceId=demo-ws(&[^#]*)?$`);

const switcher = (page: Page) =>
  page.getByRole("button", { name: "Switch project", exact: true });

async function expectProject(page: Page, name: string) {
  // The first cold render of /app/timeline/[projectSlug] can be slow on CI.
  await expect(page.getByRole("heading", { level: 1, name, exact: true })).toBeVisible({
    timeout: 20_000,
  });
}

test.describe("Timeline project switcher", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/app/timeline?workspaceId=demo-ws");
    // The bare entry replace-redirects to the canonical project path.
    await expect(page).toHaveURL(PLAN("mara-finn"));
    await expectProject(page, "Mara & Finn");
    await expect(page.getByRole("tab", { name: "All projects" })).toBeVisible();
    await expect(switcher(page)).toBeVisible();
  });

  test("switches A to B to C and preserves browser history", async ({ page }) => {
    await switcher(page).click();
    const menu = page.getByRole("menu", { name: "Switch project" });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Mara & Finn" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await menu.getByRole("menuitem", { name: "Nora & Cian", exact: true }).click();
    await expect(page).toHaveURL(PLAN("nora-cian"));
    await expectProject(page, "Nora & Cian");

    await switcher(page).click();
    await page.getByRole("menuitem", { name: "Aisling & Tom", exact: true }).click();
    await expect(page).toHaveURL(PLAN("aisling-tom"));
    await expectProject(page, "Aisling & Tom");

    await page.goBack();
    await expect(page).toHaveURL(PLAN("nora-cian"));
    await page.goBack();
    // Back lands on the first project page, never the bare entry URL.
    await expect(page).toHaveURL(PLAN("mara-finn"));
    await page.goForward();
    await expect(page).toHaveURL(PLAN("nora-cian"));

    await page.reload();
    await expectProject(page, "Nora & Cian");

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("supports keyboard selection and Escape", async ({ page }) => {
    const button = switcher(page);
    await button.focus();
    await expect(button).toBeFocused();

    await button.press("Enter");
    await expect(page.getByRole("menu")).toBeVisible();
    // The menu moves focus to the current project after it mounts; Escape is
    // the menu's key, so wait for focus to arrive before sending it.
    await expect(page.getByRole("menuitem", { name: "Mara & Finn" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(button).toBeFocused();

    await button.press("Enter");
    await expect(page.getByRole("menu")).toBeVisible();
    const target = page.getByRole("menuitem", { name: "Nora & Cian", exact: true });
    await expect(target).toBeVisible();
    // The menu owns focus through roving activeIndex; walk it with the arrow
    // key until the target holds focus, so a reordered menu still passes and a
    // broken one fails here, naming the real cause.
    for (let step = 0; step < 6; step += 1) {
      if (await target.evaluate((node) => node === document.activeElement)) break;
      await page.keyboard.press("ArrowDown");
    }
    await expect(target).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(PLAN("nora-cian"));
    await expectProject(page, "Nora & Cian");
  });
});
