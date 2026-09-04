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
      // StudioBar's browser snapshot changes this label on Windows/Linux;
      // waiting for it confirms the page reached hydration, not only SSR.
      const expectedKey = await page.evaluate(() =>
        /Mac|iPhone|iPad|iPod/.test(navigator.platform) ? "⌘K" : "Ctrl K",
      );
      await expect(page.getByRole("button", { name: "Search tasks and projects" }))
        .toContainText(expectedKey);
      expect(errors).toEqual([]);
    });
  });
}
