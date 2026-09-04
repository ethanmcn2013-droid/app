import { expect, test, type Page, type TestInfo } from "@playwright/test";

async function measureViews(page: Page) {
  return page.getByRole("navigation", { name: "View", exact: true }).evaluate((nav) => {
    type Color = [number, number, number, number];
    function rgba(value: string): Color {
      const parts = value.match(/[\d.]+/g)?.map(Number) ?? [];
      if (value.startsWith("color(srgb ")) {
        return [parts[0] * 255, parts[1] * 255, parts[2] * 255, parts[3] ?? 1];
      }
      if (value.startsWith("rgb")) return [parts[0], parts[1], parts[2], parts[3] ?? 1];
      throw new Error(`Unsupported computed color: ${value}`);
    }
    function over(foreground: Color, background: Color): Color {
      const alpha = foreground[3] + background[3] * (1 - foreground[3]);
      if (!alpha) return [0, 0, 0, 0];
      return [0, 1, 2].map((index) =>
        (foreground[index] * foreground[3] + background[index] * background[3] * (1 - foreground[3])) / alpha,
      ).concat(alpha) as Color;
    }
    function luminance(color: Color) {
      const channels = color.slice(0, 3).map((channel) => {
        const s = channel / 255;
        return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    }
    const measurements = [...nav.querySelectorAll("a")].map((link) => {
      let background: Color = [0, 0, 0, 0];
      for (let layer: Element | null = link; layer; layer = layer.parentElement) {
        const style = getComputedStyle(layer);
        if (style.backgroundImage !== "none" || Number(style.opacity) !== 1) {
          throw new Error("Contrast measurement requires solid layers at full opacity");
        }
        background = over(background, rgba(style.backgroundColor));
      }
      if (background[3] !== 1) throw new Error("No opaque background beneath view label");
      const style = getComputedStyle(link);
      const foreground = over(rgba(style.color), background);
      const light = luminance(foreground);
      const dark = luminance(background);
      return {
        label: link.textContent,
        href: link.getAttribute("href"),
        active: link.getAttribute("aria-current") === "page",
        color: style.color,
        foreground,
        background,
        contrast: (Math.max(light, dark) + 0.05) / (Math.min(light, dark) + 0.05),
        fontSize: style.fontSize,
        rect: link.getBoundingClientRect().toJSON(),
      };
    });
    return { theme: document.documentElement.dataset.theme, width: innerWidth, documentWidth: document.documentElement.scrollWidth, measurements };
  });
}

async function captureViews(page: Page, info: TestInfo, name: string) {
  const measurement = await measureViews(page);
  await info.attach(`${name}-contrast`, { body: JSON.stringify(measurement, null, 2), contentType: "application/json" });
  await info.attach(name, { body: await page.screenshot(), contentType: "image/png" });
  expect(measurement.documentWidth).toBeLessThanOrEqual(measurement.width);
  expect(measurement.measurements.map(({ label }) => label)).toEqual(["Board", "List", "Schedule", "Calendar"]);
  for (const view of measurement.measurements) {
    expect(view.rect.width, view.label ?? "view").toBeGreaterThan(0);
    expect(view.rect.x).toBeGreaterThanOrEqual(0);
    expect(view.rect.right).toBeLessThanOrEqual(measurement.width);
    expect(view.contrast, `${view.label}: ${view.color} against ${view.background}`).toBeGreaterThanOrEqual(4.5);
  }
}

test("Tasks view labels retain readable contrast on Board and List", async ({ page }, info) => {
  await page.goto("/app/tasks");
  await expect(page.locator("html")).toHaveAttribute("data-theme", info.project.use.colorScheme as string);
  const views = page.getByRole("navigation", { name: "View", exact: true });
  await expect(views.getByRole("link", { name: "Board", exact: true })).toHaveAttribute("aria-current", "page");
  await captureViews(page, info, "board");
  await views.getByRole("link", { name: "List", exact: true }).press("Enter");
  await expect(page).toHaveURL(/\/app\/tasks\/list$/);
  await expect(views.getByRole("link", { name: "List", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("table").first()).toBeVisible();
  await captureViews(page, info, "list");
});

test("isolated Board to List navigation reports all console and request faults", async ({ page }, info) => {
  const consoleFaults: Array<{ type: string; text: string; location?: unknown }> = [];
  const requestFailures: Array<{ url: string; error: string | null; method: string; prefetch: string | null }> = [];
  const failedResponses: Array<{ url: string; status: number }> = [];
  const listResponses: Array<{ url: string; status: number }> = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      consoleFaults.push({ type: message.type(), text: message.text(), location: message.location() });
    }
  });
  page.on("pageerror", (error) => consoleFaults.push({ type: "pageerror", text: error.message }));
  page.on("requestfailed", (request) => requestFailures.push({
    url: request.url(), error: request.failure()?.errorText ?? null,
    method: request.method(), prefetch: request.headers()["next-router-prefetch"] ?? null,
  }));
  page.on("response", (response) => {
    if (response.status() >= 400) failedResponses.push({ url: response.url(), status: response.status() });
    if (new URL(response.url()).pathname === "/app/tasks/list") listResponses.push({ url: response.url(), status: response.status() });
  });
  let delayedListResponses = 0;
  // Force the real loading fallback to mount, even with a warm local server.
  await page.route("**/app/tasks/list?*", async (route) => {
    if (new URL(route.request().url()).searchParams.has("_rsc")) {
      delayedListResponses += 1;
      const response = await route.fetch();
      await new Promise((resolve) => setTimeout(resolve, 600));
      await route.fulfill({ response });
    } else await route.continue();
  });
  try {
    await page.goto("/app/tasks");
    const views = page.getByRole("navigation", { name: "View", exact: true });
    await expect(views.getByRole("link", { name: "Board", exact: true })).toHaveAttribute("aria-current", "page");
    await views.getByRole("link", { name: "List", exact: true }).press("Enter");
    await expect(page).toHaveURL(/\/app\/tasks\/list$/);
    await expect(page.getByRole("table").first()).toBeVisible();
    expect(delayedListResponses).toBeGreaterThan(0);
    expect(await page.locator('[id^="stndz-"]').count()).toBe(0);
    expect(consoleFaults).toEqual([]);
    expect(failedResponses).toEqual([]);
    expect(listResponses.some(({ status }) => status === 200)).toBe(true);
    // Next cancels speculative requests when navigation supersedes them.
    // Only a same-origin GET explicitly marked as a prefetch may be cancelled.
    // Keep every cancellation in the attachment; asset/active-route failures
    // and HTTP errors remain failures, even if they also say ERR_ABORTED.
    const unexpectedFailures = requestFailures.filter((failure) => {
      const url = new URL(failure.url);
      return !(failure.error === "net::ERR_ABORTED" && failure.prefetch === "1"
        && failure.method === "GET" && url.origin === new URL(page.url()).origin
        && url.searchParams.has("_rsc"));
    });
    expect(unexpectedFailures).toEqual([]);
  } finally {
    await info.attach("console-and-requests", {
      body: JSON.stringify({ consoleFaults, requestFailures, failedResponses, listResponses, delayedListResponses, url: page.url() }, null, 2),
      contentType: "application/json",
    });
  }
});
