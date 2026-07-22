import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const TOKEN = "DemoAudienceTimelineToken2026Fixed000000000";

async function expectNoBlockingAccessibilityIssues(page: import("@playwright/test").Page) {
  const result = await new AxeBuilder({ page }).analyze();
  const blocking = result.violations.filter(
    (violation) => violation.impact === "critical" || violation.impact === "serious",
  );
  expect(blocking.map((violation) => violation.id)).toEqual([]);
}

test("shared Timeline is a clean, expressive and private artifact", async ({ page }) => {
  const externalRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin !== new URL(page.url() || "http://localhost").origin) {
      externalRequests.push(request.url());
    }
  });

  const response = await page.goto(`/s/${TOKEN}`);
  expect(response?.status()).toBe(200);
  expect(response?.headers()["cache-control"]).toContain("no-store");
  expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
  expect(response?.headers()["x-robots-tag"]).toContain("noindex");
  expect(response?.headers()["content-security-policy"]).toContain("connect-src 'self'");

  await expect(page.locator("[data-timeline-wordmark]")).toHaveText("timeline");
  await expect(page.getByRole("heading", { name: "Mara & Finn" })).toBeVisible();
  await expect(page.locator("[data-timeline-metric-value]")).toHaveText("22");
  await expect(page.getByRole("progressbar", { name: "Milestone completion" }))
    .toHaveAttribute("aria-valuenow", "22");
  await expect(page.locator("[data-today-marker]")).toHaveAttribute(
    "aria-label",
    /Our next milestone is Menu tasting at The Orchard/,
  );
  await expect(page.locator("[data-studio-rail], nav[aria-label='Products']")).toHaveCount(0);

  const toggle = page.locator("[data-timeline-metric-toggle]");
  await toggle.click();
  await expect(toggle).toHaveAttribute("data-metric-mode", "countdown");
  await expect(page.locator("[data-timeline-metric-value]")).toHaveText("73");

  const current = page.getByRole("button", { name: /Menu tasting at The Orchard/ });
  await current.focus();
  await current.press("ArrowRight");
  await expect(page.getByRole("button", { name: /Send the invitations/ })).toBeFocused();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);

  if (test.info().project.name === "mobile") {
    const minimumTarget = await page.locator("[data-timeline-scroll-viewport] button").evaluateAll(
      (buttons) => Math.min(...buttons.map((button) => button.getBoundingClientRect().height)),
    );
    expect(minimumTarget).toBeGreaterThanOrEqual(44);
  }

  await page.waitForTimeout(2_100);
  expect(externalRequests.filter((url) => /clerk|google|sentry|posthog/i.test(url))).toEqual([]);
  await expectNoBlockingAccessibilityIssues(page);
});

test("owner studio previews the same artifact without recording a view", async ({ page }) => {
  const viewWrites: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && /\/s\/[^/]+\/view$/.test(new URL(request.url()).pathname)) {
      viewWrites.push(request.url());
    }
  });

  const response = await page.goto("/app/plan/audience/demo-audience-publication");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "See the story they will see." })).toBeVisible();
  await expect(page.locator("[data-timeline-phone-preview]")).toBeVisible();
  await expect(page.locator("[data-timeline-artifact]")).toHaveCount(2);
  await expect(page.getByText("Preview only · this does not add a view", { exact: true })).toBeVisible();
  await expect(page.getByText("Timeline views", { exact: true })).toBeVisible();
  await page.waitForTimeout(2_100);
  expect(viewWrites).toEqual([]);
  await expectNoBlockingAccessibilityIssues(page);
});

test("unavailable bearer links fail closed with a generic private response", async ({ page }) => {
  const response = await page.goto("/s/invalid");
  expect(response?.headers()["cache-control"]).toContain("no-store");
  expect(response?.headers()["x-robots-tag"]).toContain("noindex");
  await expect(page.getByRole("heading", { name: "This link has reached its end." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mara & Finn" })).toHaveCount(0);
  await expect(page.locator("[data-timeline-artifact]")).toHaveCount(0);
});
