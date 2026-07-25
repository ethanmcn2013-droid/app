import { expect, test } from "@playwright/test";

test.describe("Timeline project switcher", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/app/timeline/product?workspaceId=tasks");
    await expect(
      page.getByRole("heading", { name: "Product Roadmap", exact: true }),
    ).toBeVisible();
  });

  test("switches A to B to C and preserves browser history", async ({
    page,
  }) => {
    const switcher = () =>
      page.getByRole("button", { name: /Current project:/ });

    await switcher().click();
    const options = page.getByRole("menuitem");
    await expect(options.first()).toHaveText("All projects");
    const currentOption = page.getByRole("menuitem", {
      name: /Product Roadmap/,
    });
    await expect(currentOption).toBeFocused();
    await currentOption.dispatchEvent("focusout", {
      bubbles: true,
      relatedTarget: null,
    });
    await expect(page.getByRole("menu")).toBeVisible();
    await page.getByRole("menuitem", { name: "Launch", exact: true }).click();
    await expect(page).toHaveURL(/\/app\/plan\/launch\?workspaceId=tasks$/);
    await expect(
      page.getByRole("heading", { name: "Launch", exact: true }),
    ).toBeVisible();

    await switcher().click();
    await page
      .getByRole("menuitem", { name: "Venue pilot", exact: true })
      .click();
    await expect(page).toHaveURL(
      /\/app\/plan\/venue-pilot\?workspaceId=tasks$/,
    );
    await expect(
      page.getByRole("heading", { name: "Venue pilot", exact: true }),
    ).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\/app\/plan\/launch\?workspaceId=tasks$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/app\/plan\/product\?workspaceId=tasks$/);
    await page.goForward();
    await expect(page).toHaveURL(/\/app\/plan\/launch\?workspaceId=tasks$/);

    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Launch", exact: true }),
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
      name: /Current project: Product Roadmap/,
    });
    await switcher.focus();
    await expect(switcher).toBeFocused();

    await switcher.press("Enter");
    await expect(page.getByRole("menu")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(switcher).toBeFocused();

    await switcher.press(" ");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/app\/plan\/launch\?workspaceId=tasks$/);
    await expect(
      page.getByRole("heading", { name: "Launch", exact: true }),
    ).toBeVisible();
  });
});
