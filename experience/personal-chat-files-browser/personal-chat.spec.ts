import { test as base, expect, type Locator, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";

declare global {
  interface Window {
    __personalChatBrowserDocumentId: string;
    __nativeClipboardWrite?: (text: string) => Promise<void>;
  }
}

const test = base.extend<{ guard: void }>({
  guard: [async ({ context, page, baseURL }, use, testInfo) => {
    const diagnostics = { pageErrors: [] as string[], consoleErrors: [] as string[], httpFailures: [] as string[], requestFailures: [] as { url: string; error: string }[], external: [] as string[] };
    await context.route("**/*", route => {
      if (new URL(route.request().url()).origin === baseURL) return route.continue();
      diagnostics.external.push(route.request().url());
      return route.abort("blockedbyclient");
    });
    const theme = testInfo.project.name.endsWith("dark") ? "dark" : "light";
    await context.addInitScript(theme => {
      localStorage.setItem("signal:theme-mode", theme);
      window.__personalChatBrowserDocumentId = crypto.randomUUID();
    }, theme);
    page.on("pageerror", error => diagnostics.pageErrors.push(error.stack ?? error.message));
    page.on("console", message => { if (message.type() === "error") diagnostics.consoleErrors.push(message.text()); });
    page.on("response", response => { if (response.status() >= 400) diagnostics.httpFailures.push(`${response.status()} ${response.url()}`); });
    page.on("requestfailed", request => diagnostics.requestFailures.push({ url: request.url(), error: request.failure()?.errorText ?? "unknown" }));
    await use();
    await testInfo.attach("browser-diagnostics", { body: JSON.stringify(diagnostics, null, 2), contentType: "application/json" });
    expect.soft(diagnostics.pageErrors).toEqual([]);
    expect.soft(diagnostics.consoleErrors).toEqual([]);
    expect.soft(diagnostics.httpFailures).toEqual([]);
    expect.soft(diagnostics.external).toEqual([]);
    // Retain raw cancellations: soft navigation can cancel an obsolete fetch.
    // Other request failures, including provider/asset failures, fail the case.
    expect.soft(diagnostics.requestFailures.filter(item => item.error !== "net::ERR_ABORTED")).toEqual([]);
  }, { auto: true }],
});

const panelOf = (page: Page) => page.locator('[aria-label="Chat"][role]');
const toastsOf = (page: Page) => page.locator(".signal-toast");
async function reachable(page: Page, control: Locator) {
  await expect(control).toBeVisible();
  const geometry = await control.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height, hit: hit === element || element.contains(hit) };
  });
  const viewport = page.viewportSize()!;
  expect(geometry.width).toBeGreaterThan(0);
  expect(geometry.height).toBeGreaterThan(0);
  expect(geometry.x).toBeGreaterThanOrEqual(0);
  expect(geometry.y).toBeGreaterThanOrEqual(0);
  expect(geometry.right).toBeLessThanOrEqual(viewport.width + 1);
  expect(geometry.bottom).toBeLessThanOrEqual(viewport.height + 1);
  expect(geometry.hit).toBe(true);
  return geometry;
}
async function dismissAll(page: Page) {
  const toasts = toastsOf(page);
  while (await toasts.count()) {
    const count = await toasts.count();
    const dismiss = toasts.first().getByRole("button");
    await dismiss.scrollIntoViewIfNeeded();
    await reachable(page, dismiss);
    await dismiss.click();
    await expect(toasts).toHaveCount(count - 1);
  }
}
async function emit(page: Page, title: string) {
  // UI-only notification fixture, never a claim about a server action.
  await page.evaluate(title => window.dispatchEvent(new CustomEvent("tasks:toast", {
    detail: { title, body: "Synthetic browser check. Dismiss to continue.", tone: "error" },
  })), title);
}
async function navigate(page: Page, path: string) {
  if (page.viewportSize()!.width < 680) await page.getByRole("button", { name: "Open navigation", exact: true }).click();
  const name = path === "/app/tasks" ? "Tasks" : path === "/app/analytics" ? "Analytics" : "Files";
  await page.locator("aside").getByRole("link", { name, exact: true }).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe(path);
  await page.waitForLoadState("networkidle");
}
async function nativeClipboard(page: Page, baseURL: string) {
  const copy = async () => {
    await page.getByRole("button", { name: /^More options for / }).first().click();
    await page.getByRole("menuitem", { name: "Copy project link", exact: true }).click();
    await expect(toastsOf(page)).toHaveCount(1);
  };
  await page.bringToFront();
  await copy();
  await expect(toastsOf(page)).toContainText("Project link copied");
  expect((await page.evaluate(() => navigator.clipboard.readText())).startsWith(`${baseURL}/app/project`)).toBe(true);
  await dismissAll(page);
  await page.evaluate(() => {
    window.__nativeClipboardWrite = navigator.clipboard.writeText.bind(navigator.clipboard);
    Object.defineProperty(navigator.clipboard, "writeText", { configurable: true, value: () => Promise.reject(new DOMException("Synthetic rejection", "NotAllowedError")) });
  });
  try {
    await copy();
    await expect(toastsOf(page)).toContainText("Couldn't copy the link");
    await expect(toastsOf(page)).toContainText("Open the project and copy its address from your browser.");
    await dismissAll(page);
  } finally {
    await page.evaluate(() => Object.defineProperty(navigator.clipboard, "writeText", { configurable: true, value: window.__nativeClipboardWrite }));
  }
  await copy();
  await expect(toastsOf(page)).toContainText("Project link copied");
  await dismissAll(page);
}

test("tab-local drafts, files and notifications retain a reachable compact Chat", async ({ page, context, baseURL }, testInfo) => {
  await page.goto("/app/files", { waitUntil: "networkidle" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", testInfo.project.name.endsWith("dark") ? "dark" : "light");
  if (testInfo.project.name === "desktop-light") {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: baseURL });
    await nativeClipboard(page, baseURL!);
  }
  const launcher = page.getByRole("button", { name: "Open chat", exact: true });
  await expect(launcher).toHaveCount(1);
  const launcherRect = await reachable(page, launcher);
  expect(launcherRect.width).toBe(52);
  expect(launcherRect.height).toBe(52);
  await expect(launcher).toHaveCSS("border-radius", "50%");
  await launcher.click();
  const panel = panelOf(page);
  const rect = (await panel.boundingBox())!;
  expect(rect.width).toBeLessThanOrEqual(500);
  expect(rect.height).toBeLessThan(page.viewportSize()!.height * 0.75);
  expect(rect.y).toBeGreaterThan(0);
  expect(rect.x).toBeGreaterThanOrEqual(0);
  expect(rect.y + rect.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  await expect(panel.getByRole("navigation", { name: "Conversations", exact: true })).toBeVisible();
  const team = panel.getByRole("button", { name: "Team chat", exact: true });
  await team.click({ button: "right" });
  await panel.getByRole("button", { name: "Hide for me", exact: true }).click();
  await expect(team).toHaveCount(0);
  await panel.getByRole("button", { name: "Close chat", exact: true }).click();
  await launcher.click();
  await expect(team).toHaveCount(0);
  await expect(panel.getByRole("heading", { name: "Hidden conversations", exact: true })).toBeVisible();
  await panel.getByRole("button", { name: "Show Team chat", exact: true }).click();
  await expect(team).toBeVisible();
  await expect(panel.getByRole("heading", { name: "Hidden conversations", exact: true })).toHaveCount(0);
  await panel.getByRole("button", { name: /Saved notes/ }).click();
  const self = panel.getByRole("region", { name: "Your private conversation" });
  const composer = self.getByRole("textbox", { name: "Message yourself" });
  const send = self.getByRole("button", { name: "Send message" });
  const close = panel.getByRole("button", { name: "Close chat", exact: true });
  const controls = async () => { await reachable(page, composer); await reachable(page, send); await reachable(page, close); };
  await expect(self.getByText("Preview · messages stay in this tab", { exact: true })).toBeVisible();
  await composer.fill("Synthetic draft survives soft navigation");
  await composer.press("Escape");
  await expect(panel).toBeHidden();
  await expect(launcher).toBeFocused();
  await launcher.click();
  await expect(composer).toHaveValue("Synthetic draft survives soft navigation");
  await close.click();
  const documentId = await page.evaluate(() => window.__personalChatBrowserDocumentId);
  for (const path of ["/app/analytics", "/app/tasks", "/app/files"]) {
    await navigate(page, path);
    expect(await page.evaluate(() => window.__personalChatBrowserDocumentId)).toBe(documentId);
    await expect(page.locator("[data-toast-viewport]")).toHaveCount(1);
    await emit(page, `UI-only bridge ${path}`);
    await expect(toastsOf(page)).toHaveCount(1);
    await dismissAll(page);
  }
  await launcher.click();
  await expect(composer).toHaveValue("Synthetic draft survives soft navigation");
  await composer.fill("");
  const bytes = (number: number) => Buffer.from(`Synthetic private Chat file ${number}\nExact sample bytes.\n`);
  const sample = (number: number) => ({ name: `small-${number}.txt`, mimeType: "text/plain", buffer: bytes(number) });
  const input = self.locator('input[type="file"]');
  // Exercise the real clipboard event with a synthetic image; upload remains
  // in this credential-free preview and does not send a message automatically.
  await composer.evaluate(element => {
    const clipboardData = new DataTransfer();
    clipboardData.items.add(new File([Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII="), character => character.charCodeAt(0))], "clipboard.png", { type: "image/png" }));
    element.dispatchEvent(new ClipboardEvent("paste", { clipboardData, bubbles: true, cancelable: true }));
  });
  await expect(self.getByRole("button", { name: "Remove clipboard.png", exact: true })).toBeVisible();
  await expect(composer).toHaveValue("");
  await self.getByRole("button", { name: "Remove clipboard.png", exact: true }).click();
  if (testInfo.project.name === "desktop-light") {
    await page.evaluate(() => navigator.clipboard.writeText("Ordinary text paste stays text"));
    await composer.focus();
    await composer.press("Control+V");
    await expect(composer).toHaveValue("Ordinary text paste stays text");
    await composer.fill("");
  }

  const drafts = self.getByRole("list", { name: "Files in your draft" });
  await input.setInputFiles([sample(1), sample(2), sample(3)]);
  await expect(drafts.getByRole("listitem")).toHaveCount(3);
  await expect(send).toBeEnabled();
  await controls();
  for (const number of [1, 2, 3]) {
    const remove = self.getByRole("button", { name: `Remove small-${number}.txt` });
    await remove.scrollIntoViewIfNeeded();
    await reachable(page, remove);
    await controls();
  }
  await testInfo.attach("three-staged-files", { body: await page.screenshot(), contentType: "image/png" });
  // The picker is disabled at three; remove one before selecting an invalid
  // file through the actual input. Do not force a disabled fourth upload.
  await self.getByRole("button", { name: "Remove small-3.txt" }).click();
  await input.setInputFiles({ name: "invalid.exe", mimeType: "application/x-msdownload", buffer: Buffer.from("Synthetic invalid file") });
  const notice = self.getByRole("status").filter({ hasText: "invalid.exe:" });
  await notice.scrollIntoViewIfNeeded();
  await reachable(page, notice);
  await controls();
  await expect(send).toBeEnabled();
  await testInfo.attach("invalid-file-feedback", { body: await page.screenshot(), contentType: "image/png" });
  await send.click();
  await expect(drafts).toHaveCount(0);
  await close.click();
  await launcher.click();
  const file = self.getByRole("link", { name: /small-1\.txt/ });
  await file.scrollIntoViewIfNeeded();
  await expect(file).toContainText("Download preview file");
  const downloading = page.waitForEvent("download");
  await file.click();
  const download = await downloading;
  const saved = testInfo.outputPath("small-1.txt");
  await download.saveAs(saved);
  expect(download.suggestedFilename()).toBe("small-1.txt");
  expect(await readFile(saved)).toEqual(bytes(1));
  for (const open of [true, false]) {
    if (!open) {
      await close.click();
      await expect(launcher).toBeFocused();
    }
    for (let number = 1; number <= 4; number++) await emit(page, `UI-only stack ${number}`);
    await expect(toastsOf(page)).toHaveCount(4);
    for (const toast of await toastsOf(page).all()) await expect(toast).toHaveCSS("opacity", "1");
    for (const toast of await toastsOf(page).all()) {
      const dismiss = toast.getByRole("button");
      await dismiss.scrollIntoViewIfNeeded();
      await reachable(page, dismiss);
      if (open) await controls(); else await reachable(page, launcher);
    }
    const axe = new AxeBuilder({ page }).include("[data-toast-viewport]");
    if (open) axe.include('[aria-label="Chat"][role]');
    expect((await axe.analyze()).violations).toEqual([]);
    await testInfo.attach(open ? "chat-and-notifications" : "launcher-and-notifications", { body: await page.screenshot(), contentType: "image/png" });
    await dismissAll(page);
  }
  expect(new URL(page.url()).pathname).toBe("/app/files");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});
