import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

import {
  NOTES_DELIGHT_DECISION_COUNTS,
  NOTES_DELIGHT_LEDGER,
  type NotesDelightDecision,
} from "../notes-delight-ledger.contract";

/**
 * Signal Notes — the workspace.
 *
 * Three views (Notebook, Review, Sent) inside the module canvas, no floating
 * card, one composer with three ways in. Every selector here is derived from
 * the render tree in src/modules/notes/app/workspace, and prefers the role
 * and the name a person would use over an id invented for a test.
 */

const WORKSPACE = "[data-notes-workspace]";
const COMPOSER = "[data-notes-composer]";
const ROW = "[data-note-row]";
const SENT_ROW = "[data-sent-row]";
const REVIEW_CARD = "[data-review-card]";

/** Dates a person would say out loud. "3d ago" is a log line, not a date. */
const FRIENDLY_DATE =
  /Just now|minutes? ago|hours? ago|Yesterday|days ago|\d{1,2} \w{3}/;

/** The largest duration in a computed transition/animation list, in seconds. */
function longestDuration(value: string): number {
  return value
    .split(",")
    .map((part) => {
      const trimmed = part.trim();
      const amount = Number.parseFloat(trimmed);
      if (!Number.isFinite(amount)) return 0;
      return trimmed.endsWith("ms") ? amount / 1000 : amount;
    })
    .reduce((longest, amount) => Math.max(longest, amount), 0);
}

/**
 * Load a view and wait for React to own it.
 *
 * The route streams, so the markup is on screen before any click means
 * anything. The React fiber key on the workspace root is the honest signal
 * that hydration has happened; asserting on it beats sleeping.
 */
async function openNotes(
  page: Page,
  params: Record<string, string> = {},
): Promise<Locator> {
  const search = new URLSearchParams({ fixture: "populated", ...params });
  const response = await page.goto(`/app/notes?${search.toString()}`);
  expect(response?.ok()).toBeTruthy();
  const workspace = page.locator(WORKSPACE);
  await expect(workspace).toBeVisible();
  await page.waitForFunction(() => {
    const node = document.querySelector("[data-notes-workspace]");
    return Boolean(
      node && Object.keys(node).some((key) => key.startsWith("__reactFiber$")),
    );
  });
  return workspace;
}

function viewTab(page: Page, name: "Notebook" | "Review" | "Sent"): Locator {
  return page
    .getByRole("navigation", { name: "Notes views" })
    .getByRole("link", { name });
}

function composerField(page: Page): Locator {
  return page.getByRole("textbox", { name: "Write a note" });
}

/** The reading and editing field for the open note. */
function noteBody(page: Page): Locator {
  return page.getByRole("textbox", { name: "Note", exact: true });
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

test("the workspace is the page itself, not a card floating on it", async ({
  page,
}) => {
  await openNotes(page);

  const structure = await page.evaluate(() => {
    const workspace = document.querySelector<HTMLElement>(
      "[data-notes-workspace]",
    );
    const canvas = document.querySelector<HTMLElement>(
      'main[data-product-canvas="module"]',
    );
    if (!workspace || !canvas) return null;
    const styles = getComputedStyle(workspace);
    const ancestors: { tag: string; boxShadow: string }[] = [];
    let node: HTMLElement | null = workspace.parentElement;
    while (node && node !== canvas) {
      ancestors.push({
        tag: `${node.tagName.toLowerCase()}${node.className ? `.${String(node.className).split(/\s+/)[0]}` : ""}`,
        boxShadow: getComputedStyle(node).boxShadow,
      });
      node = node.parentElement;
    }
    return {
      reachedCanvas: node === canvas,
      corners: [
        styles.borderTopLeftRadius,
        styles.borderTopRightRadius,
        styles.borderBottomRightRadius,
        styles.borderBottomLeftRadius,
      ],
      workspaceShadow: styles.boxShadow,
      ancestors,
      canvasBackground: getComputedStyle(canvas).backgroundColor,
    };
  });

  expect(structure).not.toBeNull();
  expect(structure?.reachedCanvas).toBe(true);
  expect(structure?.corners).toEqual(["0px", "0px", "0px", "0px"]);
  expect(structure?.workspaceShadow).toBe("none");
  expect(
    structure?.ancestors.filter(({ boxShadow }) => boxShadow !== "none"),
  ).toEqual([]);
  expect(structure?.canvasBackground).toBe("rgb(255, 255, 255)");
});

test("Notebook, Review and Sent are links that write themselves into the URL", async ({
  page,
}) => {
  await openNotes(page);

  await expect(viewTab(page, "Notebook")).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(viewTab(page, "Review")).not.toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(viewTab(page, "Sent")).not.toHaveAttribute(
    "aria-current",
    "page",
  );

  // Counts sit beside the tab they belong to, and they are numbers.
  const counts = page
    .getByRole("navigation", { name: "Notes views" })
    .locator("a > span");
  await expect(counts).toHaveCount(3);
  for (const text of await counts.allTextContents()) {
    expect(text.trim()).toMatch(/^\d+$/);
  }
  expect(Number((await counts.first().textContent())?.trim())).toBe(
    await page.locator(ROW).count(),
  );

  // Sent is not smuggled into the Notebook view.
  const sentHeading = page.getByRole("heading", {
    name: "Notes you turned into tasks",
  });
  await expect(sentHeading).toHaveCount(0);

  await viewTab(page, "Review").click();
  await expect(page).toHaveURL(/[?&]view=review(&|$)/);
  await expect(viewTab(page, "Review")).toHaveAttribute("aria-current", "page");
  await expect(page.locator(REVIEW_CARD)).toHaveCount(1);

  await viewTab(page, "Sent").click();
  await expect(page).toHaveURL(/[?&]view=sent(&|$)/);
  await expect(viewTab(page, "Sent")).toHaveAttribute("aria-current", "page");
  await expect(sentHeading).toHaveCount(1);

  await viewTab(page, "Notebook").click();
  await expect
    .poll(() => new URL(page.url()).searchParams.get("view"))
    .toBeNull();
  await expect(viewTab(page, "Notebook")).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(sentHeading).toHaveCount(0);
});

test("Control+Enter saves the note, puts it at the top, and opens it", async ({
  page,
}) => {
  await openNotes(page);
  const before = await page.locator(ROW).count();

  const composer = composerField(page);
  await composer.fill("Confirm the handwritten place cards before Friday.");
  await composer.press("Control+Enter");

  await expect(page.locator(ROW)).toHaveCount(before + 1);
  const first = page.locator(ROW).first();
  await expect(first).toContainText(
    "Confirm the handwritten place cards before Friday.",
  );
  await expect(first).toHaveAttribute("aria-current", "true");
  await expect(noteBody(page)).toHaveValue(
    "Confirm the handwritten place cards before Friday.",
  );
  await expect(composer).toHaveValue("");
});

test("the composer carries the whole capture and nothing it does not need", async ({
  page,
}) => {
  const workspace = await openNotes(page);
  const composer = page.locator(COMPOSER);

  await expect(page.getByRole("button", { name: "Save note" })).toBeDisabled();

  // No character counter until the writing is anywhere near the limit.
  await expect(composer.getByText(/\d[\d,]* \/ 10,000/)).toHaveCount(0);

  for (const mode of ["Type", "Voice", "Photo"]) {
    await expect(
      composer.getByRole("button", { name: mode, exact: true }),
    ).toHaveCount(1);
  }

  const text = (await workspace.textContent()) ?? "";
  expect(text).not.toContain("Escape asks before discarding");
  expect(text).not.toContain("Ctrl + Enter saves");
});

test("capture by email lives in the header menu, never in the composer", async ({
  page,
}) => {
  const workspace = await openNotes(page);

  await expect(page.locator(COMPOSER)).not.toContainText("Capture by email");
  expect((await workspace.textContent()) ?? "").not.toContain(
    "Capture by email",
  );

  await page.getByRole("button", { name: "Notes options" }).click();
  const menu = page.getByRole("menu", { name: "Notes options" });
  await expect(menu).toBeVisible();
  await expect(
    menu.getByRole("menuitem", { name: /Capture by email/ }),
  ).toBeVisible();
});

test("a draft survives a trip to Review and back", async ({ page }) => {
  await openNotes(page);
  const draft = "Half a thought about the terrace lights";

  await composerField(page).fill(draft);
  await viewTab(page, "Review").click();
  await expect(page.locator(REVIEW_CARD)).toHaveCount(1);
  await expect(page.locator(COMPOSER)).toHaveCount(0);

  await viewTab(page, "Notebook").click();
  await expect(composerField(page)).toHaveValue(draft);
});

test("slash finds the search, the match is marked, Escape clears it", async ({
  page,
}) => {
  await openNotes(page);
  const everything = await page.locator(ROW).count();

  const search = page.getByRole("searchbox", { name: "Search notebook" });
  await expect(search).not.toBeFocused();
  await page.keyboard.press("/");
  await expect(search).toBeFocused();

  await search.fill("newsletter");
  await expect(page.locator(ROW)).toHaveCount(1);
  await expect(page.locator(`${ROW} mark`).first()).toHaveText(/newsletter/i);

  await search.press("Escape");
  await expect(search).toHaveValue("");
  await expect(page.locator(ROW)).toHaveCount(everything);
});

test("a row says what it is, when it was, and in words people use", async ({
  page,
}) => {
  const workspace = await openNotes(page);

  const first = page.locator(ROW).first();
  await expect(first).toContainText("Saturday wedding, Mara + Finn");
  // The source label is the accessible half of the source icon.
  await expect(first).toContainText("Written");
  await expect(
    page.locator(ROW).filter({ hasText: "ballroom can be accessed from 8am" }),
  ).toContainText("Spoken");

  expect((await first.textContent()) ?? "").toMatch(FRIENDLY_DATE);

  const text = (await workspace.textContent()) ?? "";
  expect(text).not.toContain("3d ago");
  expect(text).not.toMatch(/\d+ active/);
  await expect(workspace.getByText(/^\d+ notes$/)).toBeVisible();
});

test("a wide screen opens with a note already open", async ({ page }) => {
  await openNotes(page);

  const selected = page.locator(`${ROW}[aria-current="true"]`);
  await expect(selected).toHaveCount(1);
  await expect(selected).toContainText("Saturday wedding, Mara + Finn");

  await expect(page.getByRole("region", { name: "Selected note" })).toBeVisible();
  await expect(noteBody(page)).toHaveValue(/Ceremony 2pm in the orchard/);
});

test("a phone keeps the list until a row is chosen, and Back returns to it", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openNotes(page);

  const detail = page.getByRole("region", { name: "Selected note" });
  await expect(page.locator(`${ROW}[aria-current="true"]`)).toHaveCount(0);
  await expect(detail).toBeHidden();

  await page.locator(ROW).first().click();
  await expect(detail).toBeVisible();
  await expect(noteBody(page)).toHaveValue(/Ceremony 2pm in the orchard/);
  await expect(page.getByRole("button", { name: "Notebook" })).toBeVisible();

  await page.goBack();
  await expect(page.locator(`${ROW}[aria-current="true"]`)).toHaveCount(0);
  await expect(detail).toBeHidden();
  await expect(page.locator(ROW).first()).toBeVisible();
});

test("editing the note and leaving the field saves it", async ({ page }) => {
  await openNotes(page);

  await page
    .locator(ROW)
    .filter({ hasText: "welcome sign by the gate" })
    .click();
  const body = noteBody(page);
  await expect(body).toHaveValue(/welcome sign by the gate/);

  await body.fill("Reprint the welcome sign before the open day.");
  await body.blur();

  await expect(page.locator(`${ROW}[aria-current="true"]`)).toContainText(
    "Reprint the welcome sign before the open day.",
  );
});

test("Turn into task opens a modal, and Escape hands the focus back", async ({
  page,
}) => {
  await openNotes(page);
  await page
    .locator(ROW)
    .filter({ hasText: "Idea for the studio newsletter" })
    .click();

  const trigger = page.getByRole("button", { name: "Turn into task" });
  await trigger.click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await expect(
    dialog.getByRole("heading", { name: "Turn this into a task" }),
  ).toBeVisible();

  const wording = dialog.getByLabel("What the task says");
  await expect(wording).toHaveValue(/Idea for the studio newsletter/);
  await wording.fill("Write the backstage piece for the newsletter");
  await expect(wording).toHaveValue(
    "Write the backstage piece for the newsletter",
  );
  await expect(dialog.getByLabel("Project")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("creating the task confirms it and links straight to it", async ({
  page,
}) => {
  await openNotes(page);
  await page
    .locator(ROW)
    .filter({ hasText: "Idea for the studio newsletter" })
    .click();
  await page.getByRole("button", { name: "Turn into task" }).click();

  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Create task" }).click();

  await expect(dialog.getByRole("heading", { name: "Task created" })).toBeVisible();
  const openTask = dialog.getByRole("link", { name: "Open task" });
  await expect(openTask).toBeVisible();
  expect(await openTask.getAttribute("href")).toMatch(/^\/app\/task\//);
});

test("Review is one note at a time with three ways out", async ({ page }) => {
  await openNotes(page, { view: "review" });

  // The old "N of M reviewed" denominator was session state: it reset on
  // reload and disagreed with the tab badge on the same screen. What is
  // true and stable is how many are still waiting.
  await expect(page.getByText(/^(\d+ notes to review|One note left)$/)).toBeVisible();
  await expect(page.locator(REVIEW_CARD)).toHaveCount(1);
  for (const name of ["Keep in Notes", "Turn into task", "Delete"]) {
    await expect(
      page.getByRole("button", { name, exact: true }),
    ).toBeVisible();
  }
});

test("Keep in Notes moves the queue on and offers the way back", async ({
  page,
}) => {
  await openNotes(page, { view: "review" });

  const body = page.locator(`${REVIEW_CARD} p`).first();
  const firstNote = (await body.innerText()).trim();
  const queueBefore = await page
    .getByText(/^(\d+ notes to review|One note left)$/)
    .innerText();

  await page.getByRole("button", { name: "Keep in Notes", exact: true }).click();

  // Deciding shortens the queue and shows a running count of this session's
  // decisions. Both are facts about now, neither is a stored denominator.
  await expect(page.getByText("1 decided just now")).toBeVisible();
  await expect(
    page.getByText(/^(\d+ notes to review|One note left)$/),
  ).not.toHaveText(queueBefore);
  await expect(body).not.toHaveText(firstNote);

  const undo = page.getByRole("button", { name: "Undo", exact: true });
  await expect(undo).toBeVisible();
  await expect(
    page.getByRole("status").filter({ has: undo }),
  ).toContainText("Kept in Notes.");
});

test("every review gesture has a button a thumb can hit", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openNotes(page, { view: "review" });

  for (const name of ["Keep in Notes", "Turn into task", "Delete"]) {
    const button = page.getByRole("button", { name, exact: true });
    await expect(button).toBeVisible();
    const box = await button.boundingBox();
    expect(box?.height ?? 0, `${name} height`).toBeGreaterThanOrEqual(44);
  }
});

test("Sent carries the task wording, the note behind it, and the way back", async ({
  page,
}) => {
  await openNotes(page, { view: "sent" });

  const detail = page.getByRole("region", { name: "Sent note" });
  await expect(detail.getByText("What the task says")).toBeVisible();
  await expect(
    detail.getByText("Confirm marquee sides with hire company before Thursday"),
  ).toBeVisible();
  await expect(detail.getByText("The note it came from")).toBeVisible();
  await expect(
    detail.getByText("Ceremony 2pm in the orchard", { exact: false }),
  ).toBeVisible();

  const openTask = detail.getByRole("link", { name: "Open task" });
  await expect(openTask).toBeVisible();
  expect(await openTask.getAttribute("href")).toMatch(/^\/app\/task\//);

  // Still in the notebook: the way back is a way back, not a restore.
  await expect(
    detail.getByRole("button", { name: "Open in Notebook" }),
  ).toBeVisible();
  await expect(
    detail.getByRole("button", { name: "Restore to Notebook" }),
  ).toHaveCount(0);

  // One that left the notebook: restore, and the promise about the task.
  await page
    .locator(SENT_ROW)
    .filter({ hasText: "Not in your notebook" })
    .first()
    .click();
  await expect(
    detail.getByRole("button", { name: "Restore to Notebook" }),
  ).toBeVisible();
  await expect(
    detail.getByText(/The task it created stays in Tasks/),
  ).toBeVisible();
  await expect(
    detail.getByRole("button", { name: "Open in Notebook" }),
  ).toHaveCount(0);
});

test("the empty states are quiet", async ({ page }) => {
  await openNotes(page, { fixture: "empty" });
  await expect(page.locator(ROW)).toHaveCount(0);
  await expect(
    page.getByText("Your notebook starts with one private thought."),
  ).toBeVisible();

  await openNotes(page, { fixture: "empty", view: "sent" });
  const nothingSent = page.getByText("Nothing sent yet");
  await expect(nothingSent).toBeVisible();
  const fontSize = await nothingSent.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).fontSize),
  );
  expect(fontSize).toBeLessThanOrEqual(20);
});

test("every control keeps its name at the width a phone uses", async ({ page }) => {
  // The three composer modes were icon-only below 600px, and their icons are
  // decorative, so all three buttons had no accessible name at all. Desktop
  // was clean, which is exactly why this is asserted at 390.
  await page.setViewportSize({ width: 390, height: 844 });
  await openNotes(page);
  for (const name of ["Type", "Voice", "Photo"]) {
    await expect(
      page.getByRole("button", { name, exact: true }),
    ).toBeVisible();
  }
  const results = await new AxeBuilder({ page })
    .include("[data-notes-workspace]")
    .analyze();
  expect(
    results.violations.filter((violation) =>
      ["serious", "critical"].includes(violation.impact ?? ""),
    ),
  ).toEqual([]);
});

test("no serious or critical accessibility violations on any of the three views", async ({
  page,
}) => {
  const blocking: string[] = [];
  for (const view of ["notebook", "review", "sent"] as const) {
    await openNotes(page, view === "notebook" ? {} : { view });
    const accessibility = await new AxeBuilder({ page })
      .include(WORKSPACE)
      .analyze();
    blocking.push(
      ...accessibility.violations
        .filter(({ impact }) => impact === "serious" || impact === "critical")
        .map(
          ({ id, impact, nodes }) =>
            `${view}: ${id} (${impact}) → ${nodes
              .map((node) => node.target.join(" "))
              .join(" | ")}`,
        ),
    );
  }
  expect(blocking).toEqual([]);
});

test("reduced motion leaves nothing travelling", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });

  await openNotes(page, { view: "review" });
  const fill = page.locator(`${WORKSPACE} [class*="reviewCard"]`);
  await expect(fill).toHaveCount(1);
  const progressMotion = await fill.evaluate((element) => {
    const styles = getComputedStyle(element);
    return {
      transition: styles.transitionDuration,
      animation: styles.animationDuration,
    };
  });
  expect(longestDuration(progressMotion.transition)).toBeLessThanOrEqual(0.001);
  expect(longestDuration(progressMotion.animation)).toBeLessThanOrEqual(0.001);

  await openNotes(page);
  const composerMotion = await page.locator(COMPOSER).evaluate((element) => {
    const styles = getComputedStyle(element);
    return {
      transition: styles.transitionDuration,
      animation: styles.animationDuration,
    };
  });
  expect(longestDuration(composerMotion.transition)).toBeLessThanOrEqual(0.001);
  expect(longestDuration(composerMotion.animation)).toBeLessThanOrEqual(0.001);
});

test("the live region exists and speaks after a save", async ({ page }) => {
  await openNotes(page);

  const live = page.locator(`${WORKSPACE} [role="status"][aria-live="polite"]`);
  await expect(live).toHaveCount(1);
  await expect(live).toHaveText("");

  const composer = composerField(page);
  await composer.fill("Ring the florist about the aisle foliage.");
  await composer.press("Control+Enter");

  await expect(live).toHaveText("Note saved.");
});
