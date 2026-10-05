import { expect, test } from "@playwright/test";

// Opposite default locales and timezones expose server/browser date drift.
// These use the suite's synthetic review workspace and never mutate settings.
for (const locale of [
  { locale: "en-US", timezoneId: "Pacific/Honolulu" },
  { locale: "en-IE", timezoneId: "Europe/Dublin" },
]) {
  test.describe(`settings hydration in ${locale.locale}`, () => {
    test.use({ ...locale, viewport: { width: 1440, height: 900 }, colorScheme: "dark" });

    test("initial settings load preserves the Created date without a hydration error", async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      await page.goto("/app/settings");
      await expect(page.getByText("Review preview, settings are read-only.")).toBeVisible();

      const createdDate = page.locator("dt").filter({ hasText: /^Created$/ })
        .locator("..").locator("dd");
      await expect(createdDate).toContainText(/\d/);
      // Hydration probe. This used to wait on the StudioBar's platform
      // shortcut label, which the v3 shell no longer renders. The Settings
      // section rail only answers a click once React has hydrated, so
      // selecting a section and seeing it become current confirms the page
      // reached hydration, not only SSR. Nothing here writes: sections switch
      // client-side and review content stays inert.
      const rail = page.getByRole("navigation", { name: "Settings sections" });
      const members = rail.getByRole("button", { name: "Members" });
      await expect(async () => {
        await members.click();
        await expect(members).toHaveAttribute("aria-current", "page", { timeout: 500 });
      }).toPass();
      // Back on General, the hydrated client snapshot still shows the date.
      await rail.getByRole("button", { name: "General" }).click();
      await expect(createdDate).toContainText(/\d/);
      expect(errors).toEqual([]);
    });
  });
}
