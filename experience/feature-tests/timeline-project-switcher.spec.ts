import { expect, test } from "@playwright/test";

test.describe("Timeline project switcher", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/app/tasks");
    await expect(
      page.getByRole("heading", { name: "The Orchard, events", exact: true }),
    ).toBeVisible();

    const timelineLink = page.locator(
      'a[data-product="timeline"]:visible',
    );
    await expect(timelineLink).toHaveCount(1);
    await expect(timelineLink).toHaveAttribute(
      "href",
      /\/app\/timeline\?.*workspaceId=demo-ws/,
    );
    await timelineLink.click();
    await expect(page).toHaveURL(
      /\/app\/timeline\?.*workspaceId=demo-ws.*planningPeriodId=demo-planning-period/,
    );
    await expect(
      page.getByRole("button", {
        name: "Current project: Mara & Finn. Switch project.",
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.locator("[data-timeline-artifact]")).toHaveCount(1);
    await expect(
      page.getByRole("heading", { name: "Mara & Finn", exact: true }),
    ).toBeVisible();
  });

  test("switches A to B to C and preserves browser history", async ({
    page,
  }) => {
    const switcher = () =>
      page.getByRole("button", { name: /Current project:/ });

    await switcher().click();
    const options = page.getByRole("menuitem");
    await expect(options).toHaveCount(3);
    await expect(options.first()).toContainText("Mara & Finn");
    await expect(
      page.getByRole("menuitem", { name: "All projects", exact: true }),
    ).toHaveCount(0);
    const currentOption = page.getByRole("menuitem", {
      name: /Mara & Finn/,
    });
    await expect(currentOption).toBeFocused();
    await currentOption.dispatchEvent("focusout", {
      bubbles: true,
      relatedTarget: null,
    });
    await expect(page.getByRole("menu")).toBeVisible();
    await page
      .getByRole("menuitem", { name: "Nora & Cian", exact: true })
      .click();
    await expect(page).toHaveURL(
      /\/app\/timeline\/nora-cian\?workspaceId=demo-ws&planningPeriodId=demo-planning-period$/,
    );
    await expect(
      page.getByRole("button", {
        name: "Current project: Nora & Cian. Switch project.",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "No visible milestones yet.",
        exact: true,
      }),
    ).toBeVisible();

    await switcher().click();
    await page
      .getByRole("menuitem", { name: "Aisling & Tom", exact: true })
      .click();
    await expect(page).toHaveURL(
      /\/app\/timeline\/aisling-tom\?workspaceId=demo-ws&planningPeriodId=demo-planning-period$/,
    );
    await expect(
      page.getByRole("button", {
        name: "Current project: Aisling & Tom. Switch project.",
        exact: true,
      }),
    ).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(
      /\/app\/timeline\/nora-cian\?workspaceId=demo-ws&planningPeriodId=demo-planning-period$/,
    );
    await page.goBack();
    await expect(page).toHaveURL(
      /\/app\/timeline\?.*workspaceId=demo-ws.*planningPeriodId=demo-planning-period/,
    );
    await page.goForward();
    await expect(page).toHaveURL(
      /\/app\/timeline\/nora-cian\?workspaceId=demo-ws&planningPeriodId=demo-planning-period$/,
    );

    await page.reload();
    await expect(
      page.getByRole("button", {
        name: "Current project: Nora & Cian. Switch project.",
        exact: true,
      }),
    ).toBeVisible();

    const box = await switcher().boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("supports keyboard selection and Escape", async ({ page }) => {
    const switcher = page.getByRole("button", {
      name: /Current project: Mara & Finn/,
    });
    await switcher.focus();
    await expect(switcher).toBeFocused();

    await switcher.press("Enter");
    await expect(page.getByRole("menu")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(switcher).toBeFocused();

    await switcher.press(" ");
    // The Enter path above waits for the menu before sending keys; this path
    // did not, so on a slow runner the keystroke landed before the menu
    // existed and the selection went nowhere.
    await expect(page.getByRole("menu")).toBeVisible();
    const target = page.getByRole("menuitem", { name: /Nora & Cian/ });
    await expect(target).toBeVisible();
    // Selection has to be driven by the keyboard: the menu owns focus through
    // its own effect on activeIndex, so calling focus() on an option is
    // overridden and Enter then activates whatever the menu still considers
    // active. Assert the arrow key landed where we expect before committing,
    // so a reordered menu fails here, naming the real cause, instead of
    // surfacing later as a wrong-destination navigation.
    await page.keyboard.press("ArrowDown");
    await expect(target).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(
      /\/app\/timeline\/nora-cian\?workspaceId=demo-ws&planningPeriodId=demo-planning-period$/,
    );
    // This is the first cold render of /app/timeline/[projectSlug] in the run,
    // and on a CI runner it can take longer than the 8s default. A captured
    // trace of the failure showed the navigation had already committed (the
    // document title read "nora-cian") while <main> was still empty, so the
    // switcher was not stale, it was not mounted yet. Wait for the page to
    // exist before asserting what it says, then allow a cold-render budget.
    await expect(
      page.getByRole("heading", { name: "No visible milestones yet." }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByRole("button", {
        name: "Current project: Nora & Cian. Switch project.",
        exact: true,
      }),
    ).toBeVisible();
  });
});
