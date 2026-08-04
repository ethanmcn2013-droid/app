import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import {
  NOTES_DELIGHT_DECISION_COUNTS,
  NOTES_DELIGHT_LEDGER,
  type NotesDelightDecision,
} from "../notes-delight-ledger.contract";

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
  const capture = page.locator("[data-notes-hybrid-capture]");
  await expect(capture).toBeVisible();
  await expect(page.locator("[data-note-row]").first()).toBeVisible();
  // The route streams before React claims the early-capture surface. Prove the
  // client event boundary is live, then return the fixture to its empty draft.
  await capture.fill("hydration check");
  await expect(page.getByRole("button", { name: "Save note" })).toBeEnabled();
  await capture.fill("");
  await expect(page.getByRole("button", { name: "Save note" })).toBeDisabled();
  return notebook;
}

test("the executable contract accounts for every exhaustive ledger decision", () => {
  expect(NOTES_DELIGHT_LEDGER).toHaveLength(48);
  expect(new Set(NOTES_DELIGHT_LEDGER.map(({ id }) => id)).size).toBe(48);
  expect(
    NOTES_DELIGHT_LEDGER.map(({ id }) => id),
  ).toEqual(
    Array.from(
      { length: 48 },
      (_, index) => `NOTES-DEL-${String(index + 1).padStart(3, "0")}`,
    ),
  );

  const actualCounts = NOTES_DELIGHT_LEDGER.reduce<
    Record<NotesDelightDecision, number>
  >(
    (counts, { decision }) => ({
      ...counts,
      [decision]: counts[decision] + 1,
    }),
    {
      HOLD_STILL: 0,
      IMMEDIATE: 0,
      SUBTLE: 0,
      STANDARD: 0,
      PROTOTYPE: 0,
    },
  );
  expect(actualCounts).toEqual(NOTES_DELIGHT_DECISION_COUNTS);
});

test("desktop opens on artifact history and enters detail only by intent", async ({
  page,
}) => {
  const notebook = await openNotebook(page);
  const capture = page.getByRole("textbox", { name: "Capture" });

  await expect(capture).toBeFocused();
  await expect(
    page.getByRole("heading", { name: "Sent to Tasks" }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Private note body" }),
  ).toHaveCount(0);
  await expect(
    page.locator("[data-note-row]").first(),
  ).not.toHaveAttribute("aria-current", "true");
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

  await page.locator("[data-note-row]").first().click();
  const detail = page.getByRole("textbox", { name: "Private note body" });
  await expect(detail).toBeVisible();
  await expect(detail).toBeFocused();

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
  expect(geometry.workspaceWidth).toBeGreaterThanOrEqual(1200);
  expect(geometry.workspaceWidth).toBeLessThanOrEqual(1400);
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
    .filter({ hasText: "Idea for the studio newsletter" })
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
    page.getByRole("heading", { name: "Send to Tasks" }),
  ).toBeVisible();
  await expect(
    page.getByText("Your note stays here.", { exact: true }),
  ).toBeVisible();
});

test("high-frequency search and exact selection remain immediate", async ({
  page,
}) => {
  await openNotebook(page);

  await page.getByRole("heading", { name: "Notebook" }).click();
  await page.keyboard.press("/");
  const search = page.getByRole("searchbox", { name: "Find in Notes" });
  await expect(search).toBeFocused();

  await search.fill("newsletter");
  const stream = page.locator('[data-delight-moment="artifact-presence"]');
  await expect(stream).toHaveAttribute("data-motion-policy", "immediate-filter");
  await expect(page.locator("[data-note-row]")).toHaveCount(1);
  await search.press("Enter");

  const detail = page.getByRole("textbox", { name: "Private note body" });
  await expect(detail).toBeFocused();
  await detail.evaluate((element) => {
    const field = element as HTMLTextAreaElement;
    field.setSelectionRange(0, Math.min(field.value.length, 30));
    field.dispatchEvent(new Event("select", { bubbles: true }));
    field.dispatchEvent(
      new KeyboardEvent("keyup", { key: "Shift", bubbles: true }),
    );
  });

  const selectedWording = page.locator(
    '[data-motion-policy="immediate-selection"]',
  );
  await expect(selectedWording).toContainText("Selected privately");
  const transform = await selectedWording.evaluate(
    (element) => getComputedStyle(element).transform,
  );
  expect(["none", "matrix(1, 0, 0, 1, 0, 0)"]).toContain(transform);
});

test("all six approved delight moments are integrated into the real Notes flow", async ({
  page,
}) => {
  await openNotebook(page);

  await expect(
    page.locator('[data-delight-moment="artifact-presence"]'),
  ).toBeVisible();
  await expect(
    page.locator('[data-delight-moment="stream-to-detail"]'),
  ).toBeVisible();

  const capture = page.getByRole("textbox", { name: "Capture" });
  await capture.fill("Confirm the handwritten place cards before Friday.");
  await capture.press("Control+Enter");
  await expect(page.locator("[data-note-row]").first()).toContainText(
    "Confirm the handwritten place cards",
  );

  await page
    .locator("[data-note-row]")
    .filter({ hasText: "Small thing but it matters" })
    .click();
  const detail = page.getByRole("textbox", { name: "Private note body" });
  await detail.evaluate((element) => {
    const field = element as HTMLTextAreaElement;
    const end = Math.min(field.value.length, 34);
    field.focus();
    field.setSelectionRange(0, end);
    field.dispatchEvent(new Event("select", { bubbles: true }));
    field.dispatchEvent(
      new KeyboardEvent("keyup", { key: "Shift", bubbles: true }),
    );
  });

  await expect(
    page.locator('[data-delight-moment="private-to-approved"]'),
  ).toContainText("Selected privately");
  await page.getByRole("button", { name: "Use selection" }).click();
  await expect(
    page
      .locator('[data-delight-moment="private-to-approved"]')
      .filter({ hasText: "Approved source" }),
  ).toContainText("Approved source");

  await page
    .getByRole("button", { name: "Send to Tasks", exact: true })
    .click();
  await expect(
    page.locator('[data-delight-moment="approved-to-tasks"]'),
  ).toHaveAttribute("data-state", "complete");
  await expect(page.getByText(/^Sent to .+\.$/).first()).toBeVisible();

  await page.getByRole("button", { name: "Delete…" }).click();
  await expect(
    page.locator('[data-delight-moment="decision-region"]'),
  ).toContainText("Delete this private note?");
  await page.getByRole("button", { name: "Delete note" }).click();
  const undo = page.getByRole("button", { name: "Undo", exact: true });
  await expect(
    page
      .locator('[data-delight-moment="toast-lifecycle"]')
      .filter({ hasText: "Note deleted." }),
  ).toContainText("Note deleted.");
  await expect(undo).toBeFocused();
  await undo.click();
  await expect(
    page
      .locator('[data-delight-moment="toast-lifecycle"]')
      .filter({ hasText: "Note restored." }),
  ).toContainText("Note restored.");
});

test("lost Tasks receipts retry immutably without replaying handoff travel", async ({
  page,
}) => {
  await openNotebook(page, "populated", "tasks-lost-reply");
  await page
    .locator("[data-note-row]")
    .filter({ hasText: "Idea for the studio newsletter" })
    .click();

  const detail = page.getByRole("textbox", { name: "Private note body" });
  await detail.evaluate((element) => {
    const field = element as HTMLTextAreaElement;
    field.setSelectionRange(0, Math.min(field.value.length, 36));
    field.dispatchEvent(new Event("select", { bubbles: true }));
    field.dispatchEvent(
      new KeyboardEvent("keyup", { key: "Shift", bubbles: true }),
    );
  });
  await page.getByRole("button", { name: "Use selection" }).click();
  await page
    .getByRole("button", { name: "Send to Tasks", exact: true })
    .click();

  const retry = page.getByRole("button", { name: "Retry approved send" });
  await expect(retry).toBeVisible();
  await expect(
    page.getByText("Locked for this exact receipt retry"),
  ).toBeVisible();
  await retry.click();

  await expect(
    page.locator(
      '[data-delight-moment="approved-to-tasks"][data-state="complete"]',
    ),
  ).toHaveAttribute("data-handoff-travel", "false");
  await expect(page.getByText(/^Sent to .+\.$/).first()).toBeVisible();
});

test("capture, conflict, and archive recovery use one attached decision grammar", async ({
  page,
}) => {
  await openNotebook(page);

  const capture = page.getByRole("textbox", { name: "Capture" });
  await capture.fill("Keep this exact unsaved line.");
  await capture.press("Escape");
  const keepWriting = page.getByRole("button", { name: "Keep writing" });
  await expect(
    page.locator('[data-delight-moment="decision-region"]'),
  ).toContainText("Discard this unsaved capture?");
  await expect(keepWriting).toBeFocused();
  await keepWriting.click();
  await capture.fill("");

  const activeBefore = await page.locator("[data-note-row]").count();
  await page.getByRole("button", { name: "Restore to notebook" }).first().click();
  await expect(page.locator("[data-note-row]")).toHaveCount(activeBefore + 1);
  await expect(
    page
      .locator('[data-delight-moment="toast-lifecycle"]')
      .filter({ hasText: "Private source restored" }),
  ).toBeVisible();

  await openNotebook(page, "populated", "conflict");
  await page
    .locator("[data-note-row]")
    .filter({ hasText: "Idea for the studio newsletter" })
    .click();
  const detail = page.getByRole("textbox", { name: "Private note body" });
  await detail.fill(`${await detail.inputValue()}\nLocal revision.`);
  await page.getByRole("button", { name: "Save edit" }).click();
  await expect(
    page.locator('[data-delight-moment="decision-region"]'),
  ).toContainText("This note changed somewhere else.");
  await expect(page.getByRole("button", { name: "Keep mine" })).toBeFocused();
});

test("reduced motion keeps every state change functional without transform travel", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openNotebook(page);
  await page.locator("[data-note-row]").nth(2).click();

  const detailSurface = page.locator(
    '[data-delight-moment="stream-to-detail"]',
  );
  await expect(detailSurface).toBeVisible();
  const motion = await detailSurface.evaluate((element) => {
    const styles = getComputedStyle(element);
    return {
      animationDuration: styles.animationDuration,
      transitionDuration: styles.transitionDuration,
      transform: styles.transform,
    };
  });
  expect(motion.animationDuration).toMatch(/^(0s|0\.001s)$/);
  expect(motion.transitionDuration).toBe("0s");
  expect(["none", "matrix(1, 0, 0, 1, 0, 0)"]).toContain(motion.transform);
});

test("empty, first-capture, partial, long-content, and read-only states stay legible", async ({
  page,
}) => {
  await page.goto("/app/notes?fixture=empty");
  await expect(page.locator('[data-hybrid-notebook="true"]')).toBeVisible();
  await expect(page.locator("[data-note-row]")).toHaveCount(0);
  await expect(
    page.getByText("Your notebook starts with one private thought."),
  ).toBeVisible();

  await page.goto("/app/notes?fixture=first-capture");
  await expect(page.getByText("Your notebook starts here.")).toBeVisible();

  await page.goto("/app/notes?fixture=partial-failure");
  await expect(
    page.getByRole("status").filter({
      hasText: "Connected details are temporarily unavailable.",
    }),
  ).toBeVisible();

  await openNotebook(page, "long-content");
  await page.locator("[data-note-row]").first().click();
  const longNote = page.getByRole("textbox", { name: "Private note body" });
  await expect(longNote).toBeFocused();
  expect(
    await longNote.evaluate((element) => getComputedStyle(element).scrollBehavior),
  ).toBe("auto");

  await page.goto("/app/notes?fixture=populated&hybridMode=read-only");
  const readOnlyCapture = page.locator("[data-notes-hybrid-capture]");
  await expect(readOnlyCapture).toBeVisible();
  await expect(readOnlyCapture).toHaveAttribute("readonly", "");
  await expect(page.getByRole("button", { name: "Save note" })).toBeDisabled();
});

test("email capture is integrated beside capture guidance without decorative emoji", async ({
  page,
}) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
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

  await page.getByRole("button", { name: "Copy capture email address" }).click();
  await expect(
    page
      .locator('[data-delight-moment="toast-lifecycle"]')
      .filter({ hasText: "Capture email address copied." }),
  ).toBeVisible();
});
