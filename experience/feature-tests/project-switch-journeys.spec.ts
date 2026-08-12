import { expect, test, type Page } from "@playwright/test";
import {
  PROJECT_TRUTH_A,
  PROJECT_TRUTH_B,
  PROJECT_TRUTH_INACCESSIBLE_ID,
  projectTruthContentFor,
  type FixtureProjectSummary,
} from "../../src/lib/project-truth-fixture";

/**
 * WP0 · Multi-Project browser journeys (plan §13.4).
 *
 * The existing `timeline-project-switcher.spec.ts` switches between three
 * Timeline-local children of ONE Tasks Project. That proves Timeline-child
 * switching and nothing about Project identity. This file proves the thing the
 * wave exists for: an A/B Tasks **Project** journey where the URL, the chrome
 * and the rendered content commit to the same Project (ADR 0001 §2).
 *
 * HOW TO READ THE THREE GROUPS
 *
 *  1. **Invariants** run and pass today, and must keep passing. They are also
 *     this file's liveness canary: if the app fails to build or serve, these
 *     fail loudly and the run exits non-zero.
 *
 *  2. **Red contracts** are marked `test.fail()`. They drive a real browser
 *     and make real assertions; they fail today because nothing resolves an
 *     explicit `workspaceId` on Tasks yet, which is exactly WP0's deliverable
 *     ("add failing end-to-end contracts for A→A/B→B before implementation").
 *     Playwright runs them, confirms they fail, and the run stays green. When
 *     WP2/WP3 land, each body starts passing and Playwright reports
 *     "expected to fail but passed" — so the implementer must delete the
 *     `test.fail()` line. The ratchet is the point: these cannot be forgotten.
 *
 *  3. **Deferred** journeys are `test.fixme`, each naming the work package
 *     that unblocks it. They are listed rather than omitted so §13.4 coverage
 *     is readable as a whole.
 *
 * The fixture is `src/lib/project-truth-fixture.ts`. A and B are deliberately
 * unmistakable — different names, different distinct words, different task
 * counts — so a wrong-Project render is a failed string assertion rather than
 * a judgement call.
 */

/** Shorter than the 8s default: these assertions are expected to fail today, and
 * waiting the full budget 24 times is minutes of nothing. Still generous enough
 * for a cold first render once WP2 makes them pass. */
const RED_BUDGET = 6_000;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The canonical Tasks URL for an explicit Project (ADR 0001 §8). */
function tasksUrl(projectId: string): string {
  return `/app/tasks?workspaceId=${encodeURIComponent(projectId)}`;
}

/**
 * Every Project id the rendered frame commits to, read from the links the
 * chrome emits. ADR 0001 §2 makes disagreement here a release blocker, and it
 * is the check that does not depend on the fixture being wired into the app:
 * a frame that silently substitutes another Project fails this today, for
 * exactly the right reason.
 */
async function committedProjectIds(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const found = new Set<string>();
    for (const anchor of Array.from(document.querySelectorAll("a[href]"))) {
      const href = anchor.getAttribute("href") ?? "";
      const match = /[?&]workspaceId=([^&#]*)/.exec(href);
      if (match?.[1]) found.add(decodeURIComponent(match[1]));
    }
    return Array.from(found).sort();
  });
}

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
}

/**
 * The single Project commit: URL, chrome and content all name the same
 * Project, and the sibling Project is nowhere on screen.
 */
async function expectCommittedTo(
  page: Page,
  project: FixtureProjectSummary,
  sibling: FixtureProjectSummary,
): Promise<void> {
  await expect(page).toHaveURL(
    new RegExp(`workspaceId=${escapeRegExp(project.id)}(&|$)`),
  );
  // The chrome must not point anywhere else. This is the assertion that fails
  // today: the shell still emits the ambient cookie's Project.
  expect(await committedProjectIds(page)).toEqual([project.id]);
  await expect(page.getByText(project.name).first()).toBeVisible({
    timeout: RED_BUDGET,
  });
  const siblingWord = projectTruthContentFor(sibling.id).distinctWord;
  await expect(page.getByText(siblingWord)).toHaveCount(0);
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

// ── 1 · Invariants that hold today and must keep holding ────────────────────

test.describe("Active Project · frame invariants", () => {
  test("the Tasks frame commits to exactly one Project", async ({ page }) => {
    await page.goto("/app/tasks");
    await expect(page.locator("main")).toBeVisible();

    const committed = await committedProjectIds(page);
    // The chrome has to name a Project at all — a frame that carries none has
    // no Project truth to be right or wrong about.
    expect(committed.length).toBeGreaterThanOrEqual(1);
    // And exactly one. Two different workspaceId values in one frame is the
    // mixed-project frame plan §13.4 #13 forbids, and the defect class this
    // whole wave exists to close.
    expect(committed).toHaveLength(1);
  });

  test("the Tasks frame does not overflow horizontally", async ({ page }) => {
    await page.goto("/app/tasks");
    await expect(page.locator("main")).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  });
});

// ── 2 · Red contracts: real journeys, failing until WP2/WP3 ─────────────────

test.describe("Active Project · A/B journeys", () => {
  test("§13.4 #4 · Tasks A opens A and Tasks B opens B", async ({ page }) => {
    // RED until WP2 (resolver + URL helpers) and WP3 (Tasks pages accept a
    // resolved Project instead of reading the cookie). Delete test.fail() then.
    test.fail();

    await page.goto(tasksUrl(PROJECT_TRUTH_A.id));
    await expectCommittedTo(page, PROJECT_TRUTH_A, PROJECT_TRUTH_B);

    await page.goto(tasksUrl(PROJECT_TRUTH_B.id));
    await expectCommittedTo(page, PROJECT_TRUTH_B, PROJECT_TRUTH_A);
  });

  test("§13.4 #4 · reload keeps the Project the URL asked for", async ({
    page,
  }) => {
    // RED until WP2/WP3. The URL is current-tab truth (ADR 0001 §4): a reload
    // must re-resolve B, never fall back to the last selected Project.
    test.fail();

    await page.goto(tasksUrl(PROJECT_TRUTH_B.id));
    await page.reload();
    await expectCommittedTo(page, PROJECT_TRUTH_B, PROJECT_TRUTH_A);
  });

  test("§13.4 #4 · a copied deep link opens its own Project in a fresh session", async ({
    browser,
  }) => {
    // RED until WP2/WP3. A pasted link arrives with no cookie history, which
    // is the case that must not resolve to "whichever Project was last used".
    test.fail();

    const context = await browser.newContext();
    const fresh = await context.newPage();
    try {
      await fresh.emulateMedia({ reducedMotion: "reduce" });
      await fresh.goto(tasksUrl(PROJECT_TRUTH_B.id));
      await expectCommittedTo(fresh, PROJECT_TRUTH_B, PROJECT_TRUTH_A);
    } finally {
      await context.close();
    }
  });

  test("§13.4 #4 · Back and Forward walk between A and B", async ({ page }) => {
    // RED until WP2/WP3. History entries carry their own Project; neither
    // direction may re-resolve through the cookie.
    test.fail();

    await page.goto(tasksUrl(PROJECT_TRUTH_A.id));
    await page.goto(tasksUrl(PROJECT_TRUTH_B.id));

    await page.goBack();
    await expectCommittedTo(page, PROJECT_TRUTH_A, PROJECT_TRUTH_B);

    await page.goForward();
    await expectCommittedTo(page, PROJECT_TRUTH_B, PROJECT_TRUTH_A);
  });

  test("§13.4 #6 · two tabs pinned to A and B stay independent", async ({
    page,
    context,
  }) => {
    // RED until WP2/WP3. Both tabs share one HttpOnly cookie, so this is the
    // journey that catches a shell scoping content by the cookie: whichever
    // tab loaded second would otherwise win both.
    test.fail();

    const tabA = page;
    const tabB = await context.newPage();
    await tabB.emulateMedia({ reducedMotion: "reduce" });

    await tabA.goto(tasksUrl(PROJECT_TRUTH_A.id));
    await tabB.goto(tasksUrl(PROJECT_TRUTH_B.id));

    // Re-check A after B loaded: the second navigation must not have moved it.
    await expectCommittedTo(tabB, PROJECT_TRUTH_B, PROJECT_TRUTH_A);
    await tabA.bringToFront();
    await expectCommittedTo(tabA, PROJECT_TRUTH_A, PROJECT_TRUTH_B);
  });

  test("§13.4 #5 · an inaccessible Project never substitutes another one", async ({
    page,
  }) => {
    // RED until WP2. ADR 0001 §3/§4: missing, forbidden and deleted collapse
    // into one neutral `unavailable`, and the resolver must "never choose a
    // substitute". Today the frame quietly commits the ambient Project, which
    // is precisely what this asserts against.
    test.fail();

    await page.goto(tasksUrl(PROJECT_TRUTH_INACCESSIBLE_ID));
    const committed = await committedProjectIds(page);
    expect(
      committed.filter((id) => id !== PROJECT_TRUTH_INACCESSIBLE_ID),
    ).toEqual([]);
    // Nothing from an accessible Project may paint under an unavailable one.
    await expect(
      page.getByText(projectTruthContentFor(PROJECT_TRUTH_A.id).distinctWord),
    ).toHaveCount(0);
  });
});

// ── 3 · Deferred journeys, each named to the work package that unblocks it ──

test.describe("Active Project · deferred journeys", () => {
  test.fixme(
    "§13.4 #1–#2 · Tasks A → Timeline A, Tasks B → Timeline B",
    () => {
      // WP4 — Timeline binding. Each Project must bind to its own hidden
      // Timeline workspace before a per-Project Tasks→Timeline hop can mean
      // anything; today one binding exists (DECISIONS.md D-009).
    },
  );

  test.fixme(
    "§13.4 #3 · switch to B in Timeline, then Notes → Tasks → Project Overview → Home → Timeline stay B",
    () => {
      // WP6 — the shared Project selector. There is no cross-product control
      // to switch with; WP2 must also supply the contextual link builder that
      // carries B across the hop.
    },
  );

  test.fixme("§13.4 #4 · Ctrl/Cmd-click opens B in a new tab", () => {
    // WP6 — the selector's rows are the only place a Project link exists to
    // modifier-click. Once it exists this joins the two-tabs journey above.
  });

  test.fixme(
    "§13.4 #5 · create, rename, archive and restore refresh the shell catalog with no stale route snapshot",
    () => {
      // WP6 — Tasks Project management. The lifecycle actions do not exist,
      // and WP2 owns the catalog the shell would refresh.
    },
  );

  test.fixme(
    "§13.4 #6 · create, edit, import and share cannot cross-target from a second tab",
    () => {
      // WP3 — mutation-safety migration. Until the 101 ambient call sites are
      // classified and migrated there is no per-Project write path to aim at.
    },
  );

  test.fixme(
    "§13.4 #7 · rapid B then C serialises to one accepted intent, and a late A1 response is ignored",
    () => {
      // WP2 — shared provider, route-key plus navigation-epoch stale-response
      // guard. There is no pending-switch state to race today.
    },
  );

  test.fixme(
    "§13.4 #8 · zero, one and fourteen Projects, duplicate and long names, three periods, shared and archived",
    () => {
      // WP5 (the isolated design lab renders the scenarios) and WP6 (the
      // selector groups them). The data is ready now:
      // PROJECT_TRUTH_SCENARIOS in src/lib/project-truth-fixture.ts carries
      // zero-projects, one-project and full-catalog as separate selections.
    },
  );

  test.fixme(
    "§13.4 #9 · Timeline unprepared, empty, ambiguous legacy, multiple children, archived manage and revoke",
    () => {
      // WP4 — Timeline states and the exact-only resolver. The fixture already
      // carries the absent, empty, ready, archived and legacy-multiple cases.
    },
  );

  test.fixme(
    "§13.4 #10 · primary owner, co-owner, member, downgrade, and access revoked while open",
    () => {
      // WP2 supplies capabilities; WP4 supplies the bounded membership-revision
      // revalidation that clears an already-open view.
    },
  );

  test.fixme(
    "§13.4 #11 · Notes All / This project / Unfiled, and an A note under ambient B",
    () => {
      // WP8 — Notes integration and handoff reliability.
    },
  );

  test.fixme(
    "§13.4 #12 · Home current, period and all read scopes with exact evidence links",
    () => {
      // WP9 — Home, Briefing and Project Overview. D-014 records that Home and
      // the Full Briefing carry opposite defects and are two separate items.
    },
  );

  test.fixme("§13.4 #13 · offline privacy shell and reconnect", () => {
    // WP2/WP6 — the offline event must cover Project content with a privacy
    // shell. No such shell exists to assert against.
  });
});
