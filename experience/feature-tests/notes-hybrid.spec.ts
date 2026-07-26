import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function openNotebook(
  page: Page,
  fixture = "populated",
  hybridMode?: string,
) {
  const params = new URLSearchParams({ fixture });
  if (hybridMode) params.set("hybridMode", hybridMode);
  const response = await page.goto(`/app/notes?${params.toString()}`);
  expect(response?.ok()).toBeTruthy();

  const notebook = page.locator('[data-hybrid-notebook="true"]');
  await expect(notebook).toBeVisible();
  await page.waitForFunction(() => {
    const capture = document.querySelector("[data-notes-hybrid-capture]");
    return Boolean(
      capture &&
        Object.keys(capture).some((key) => key.startsWith("__reactProps$")) &&
        typeof (
          window as typeof window & {
            __signalNotesClaimEarlyCapture?: unknown;
          }
        ).__signalNotesClaimEarlyCapture === "undefined",
    );
  });
  return notebook;
}

test("desktop keeps capture in focus while passively previewing the newest note", async ({
  page,
}) => {
  const notebook = await openNotebook(page);
  const capture = page.getByRole("textbox", { name: "Capture" });
  const detail = page.getByRole("textbox", { name: "Private note body" });

  await expect(capture).toBeFocused();
  await expect(detail).toBeVisible();
  await expect(detail).not.toBeFocused();
  await expect(
    page.locator("[data-note-row]").first(),
  ).toHaveAttribute("aria-current", "true");
  await expect(
    page.getByRole("searchbox", { name: "Find in Notes" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: "Notes" }),
  ).toHaveCount(1);
  await expect(page.getByText("Synced account", { exact: true })).toHaveCount(0);
  await expect(
    page.getByText("Tasks destinations are unavailable", { exact: false }),
  ).toHaveCount(0);

  const geometry = await notebook.evaluate((root) => {
    const workspace = root.querySelector<HTMLElement>('[class*="workspace"]');
    const stream = root.querySelector<HTMLElement>('[class*="streamPane"]');
    const detailPane = root.querySelector<HTMLElement>('[class*="detailPane"]');
    const textarea = root.querySelector<HTMLElement>('[class*="detailTextarea"]');
    return {
      workspaceWidth: workspace?.getBoundingClientRect().width ?? 0,
      rootHeight: root.getBoundingClientRect().height,
      workspaceHeight: workspace?.getBoundingClientRect().height ?? 0,
      streamOverflow: stream ? getComputedStyle(stream).overflowY : "",
      detailOverflow: detailPane ? getComputedStyle(detailPane).overflowY : "",
      readingWidth: textarea?.getBoundingClientRect().width ?? 0,
    };
  });
  expect(geometry.workspaceWidth).toBeGreaterThanOrEqual(1240);
  expect(geometry.workspaceWidth).toBeLessThanOrEqual(1360);
  expect(geometry.workspaceHeight).toBeLessThanOrEqual(geometry.rootHeight);
  expect(geometry.streamOverflow).toBe("auto");
  expect(geometry.detailOverflow).toBe("auto");
  expect(geometry.readingWidth).toBeLessThanOrEqual(760);

  const accessibility = await new AxeBuilder({ page })
    .include('[data-hybrid-notebook="true"]')
    .analyze();
  expect(
    accessibility.violations.filter(({ impact }) =>
      impact === "serious" || impact === "critical",
    ),
  ).toEqual([]);
});

test("mobile leaves the stream closed until a person chooses a note", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openNotebook(page);

  const capture = page.getByRole("textbox", { name: "Capture" });
  await expect(capture).toBeFocused();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.locator("[data-note-row]").first(),
  ).not.toHaveAttribute("aria-current", "true");

  await page.locator("[data-note-row]").first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("textbox", { name: "Private note body" }),
  ).toBeFocused();
});

test("Tasks destination appears only after exact wording enters approval", async ({
  page,
}) => {
  await openNotebook(page);
  await expect(page.getByLabel("Tasks destination")).toHaveCount(0);

  await page
    .locator("[data-note-row]")
    .filter({ hasText: "Florist can do the arch" })
    .click();
  const detail = page.getByRole("textbox", { name: "Private note body" });
  await detail.evaluate((element) => {
    const field = element as HTMLTextAreaElement;
    const end = Math.min(field.value.length, 24);
    field.focus();
    field.setSelectionRange(0, end);
    document.dispatchEvent(new Event("selectionchange", { bubbles: true }));
    field.dispatchEvent(new Event("select", { bubbles: true }));
    field.dispatchEvent(new KeyboardEvent("keyup", { key: "Shift", bubbles: true }));
  });
  await page.getByRole("button", { name: "Use selection" }).click();

  await expect(page.getByLabel("Tasks destination")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Make this work" }),
  ).toBeVisible();
  await expect(
    page.getByText("Your note stays here.", { exact: true }),
  ).toBeVisible();
});

test("email capture is integrated beside capture guidance without decorative emoji", async ({
  page,
}) => {
  await openNotebook(page, "capture-email");
  const composer = page
    .getByRole("textbox", { name: "Capture" })
    .locator("xpath=ancestor::section");
  const emailCapture = composer.getByLabel("Email capture address");

  await expect(emailCapture).toBeVisible();
  await expect(emailCapture).toContainText("Capture by email");
  await expect(emailCapture).toContainText(
    "review-notebook@capture.signalstudio.test",
  );
  expect(await emailCapture.textContent()).not.toContain("✉");
});
