import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Response, type TestInfo } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { removeDeclaredComponentError } from "../materiality-source-fixtures/runtime";
import {
  isCompletedQualifiedViewResponse,
  isIntentionalEventSourceDisableResponse,
  normalizeUrl,
  runtimeFailures,
  type MainDocumentAllowance,
  type RuntimeIssue,
  type RuntimeWatch,
} from "../runtime-policy";

type FixtureCase = {
  name: string;
  path: string;
  states: string[];
  expectedStatus?: number;
  assertions: StateAssertion[];
};

type AssertionRole = "button" | "dialog" | "heading" | "link" | "textbox";
type StateAssertion =
  | { kind: "url"; pathname: string; proves: string[] }
  | { kind: "text"; text: string; proves: string[] }
  | {
      kind: "role";
      role: AssertionRole;
      name?: string;
      count?: number;
      disabled?: boolean;
      value?: string;
      href?: string;
      proves: string[];
    };

type FixtureEntry = {
  id: string;
  evidence: "rendered" | "source-contract";
  cases?: FixtureCase[];
  interaction?: "command-palette" | "quick-create" | "task-detail-panel";
  caseName?: string;
  states?: string[];
  assertions?: StateAssertion[];
};

type FixtureManifest = {
  experiences: FixtureEntry[];
  supplementalMaterialityRendered: Array<{id: string; source: string; kind: "component" | "route" | "resources"; caseName: string; path: string; selector: string; states: string[]}>;
};

const manifest = JSON.parse(
  readFileSync(path.join(process.cwd(), "experience", "critical-fixtures.json"), "utf8"),
) as FixtureManifest;

const routeCases = manifest.experiences.flatMap((entry) =>
  (entry.cases ?? []).map((fixture) => ({ experienceId: entry.id, ...fixture })),
);

function watchRuntime(page: Page): RuntimeWatch {
  const issues: RuntimeIssue[] = [];
  const intentionalEventSourceTeardowns = new Set<string>();
  const completedQualifiedViewWrites = new Set<string>();
  page.on("pageerror", (error) => issues.push({ kind: "pageerror", message: error.message }));
  page.on("console", (message) => {
    if (message.type() === "error") {
      issues.push({
        kind: "console",
        message: message.text(),
        url: message.location().url,
      });
    }
  });
  page.on("response", (response) => {
    const request = response.request();
    if (
      isIntentionalEventSourceDisableResponse(
        {
          headers: response.headers(),
          method: request.method(),
          resourceType: request.resourceType(),
          status: response.status(),
          url: response.url(),
        },
        page.url(),
      )
    ) {
      intentionalEventSourceTeardowns.add(normalizeUrl(response.url()));
    }
    if (
      isCompletedQualifiedViewResponse(
        {
          headers: response.headers(),
          method: request.method(),
          resourceType: request.resourceType(),
          status: response.status(),
          url: response.url(),
        },
        page.url(),
      )
    ) {
      completedQualifiedViewWrites.add(normalizeUrl(response.url()));
    }
    if (response.status() >= 400) {
      issues.push({
        kind: "http",
        status: response.status(),
        resourceType: request.resourceType(),
        url: response.url(),
      });
    }
  });
  page.on("requestfailed", (request) => {
    issues.push({
      kind: "requestfailed",
      message: request.failure()?.errorText ?? "unknown network failure",
      resourceType: request.resourceType(),
      url: request.url(),
    });
  });
  return { issues, intentionalEventSourceTeardowns, completedQualifiedViewWrites };
}

async function expectNoBlockingAccessibilityIssues(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  const blocking = result.violations.filter(
    (violation) => violation.impact === "critical" || violation.impact === "serious",
  );
  expect(
    blocking.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.map((node) => ({
        target: node.target,
        html: node.html,
        summary: node.failureSummary,
      })),
    })),
  ).toEqual([]);
}

async function expectNoDocumentOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

async function expectStateAssertions(page: Page, assertions: StateAssertion[]) {
  for (const assertion of assertions) {
    const proof = assertion.proves.join(", ");
    await test.step(`prove state: ${proof}`, async () => {
      if (assertion.kind === "url") {
        await expect.poll(() => new URL(page.url()).pathname).toBe(assertion.pathname);
        return;
      }
      if (assertion.kind === "text") {
        const locator = page.getByText(assertion.text, { exact: true });
        await expect(locator).toHaveCount(1);
        await expect(locator).toBeVisible();
        return;
      }

      const locator = page.getByRole(assertion.role, {
        ...(assertion.name === undefined ? {} : { name: assertion.name, exact: true }),
      });
      const count = assertion.count ?? 1;
      await expect(locator).toHaveCount(count);
      if (count === 0) return;
      await expect(locator.first()).toBeVisible();
      if (assertion.disabled !== undefined) {
        if (assertion.disabled) await expect(locator.first()).toBeDisabled();
        else await expect(locator.first()).toBeEnabled();
      }
      if (assertion.value !== undefined) {
        await expect(locator.first()).toHaveValue(assertion.value);
      }
      if (assertion.href !== undefined) {
        await expect(locator.first()).toHaveAttribute("href", assertion.href);
      }
    });
  }
}

async function expectKeyboardEntry(page: Page) {
  let lastFocus = "none";
  for (let attempt = 0; attempt < 24; attempt += 1) {
    await page.keyboard.press("Tab");
    const focus = await page.evaluate(() => {
      const active = document.activeElement;
      if (!(active instanceof HTMLElement)) {
        return { accepted: false, description: "none" };
      }
      if (active.tagName.toLowerCase() === "nextjs-portal") {
        return { accepted: false, description: "Next.js development tools" };
      }
      const rect = active.getBoundingClientRect();
      const style = window.getComputedStyle(active);
      const visible =
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== "none" &&
        style.visibility !== "hidden";
      return {
        accepted: visible && active.matches(":focus-visible"),
        description:
          active.getAttribute("aria-label") ??
          active.textContent?.trim().slice(0, 80) ??
          active.tagName.toLowerCase(),
      };
    });
    lastFocus = focus.description;
    if (focus.accepted) return;
  }
  throw new Error(
    `Tab navigation did not reach a visible app focus target; last focus: ${lastFocus}`,
  );
}

async function enterDeterministicMotionMode(page: Page) {
  // Let React hydrate against the server's default media state first, then
  // switch the live surface to reduced motion for the audit and capture.
  await page.waitForLoadState("load");
  await page.waitForTimeout(300);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForTimeout(100);
}

async function attachRenderedEvidence(
  page: Page,
  testInfo: TestInfo,
  experienceId: string,
  caseName: string,
) {
  const body = await page.screenshot({
    fullPage: true,
    animations: "disabled",
    caret: "hide",
  });
  await testInfo.attach(`${experienceId}-${caseName}-${testInfo.project.name}`, {
    body,
    contentType: "image/png",
  });
}

type TimelineRuntimeEvidence = {
  externalRequests: string[];
  viewRequests: string[];
  viewResponses: number[];
};

function watchTimelineRuntime(page: Page): TimelineRuntimeEvidence {
  const evidence: TimelineRuntimeEvidence = {
    externalRequests: [],
    viewRequests: [],
    viewResponses: [],
  };
  page.on("request", (request) => {
    const requestUrl = new URL(request.url());
    const pageUrl = page.url() ? new URL(page.url()) : null;
    if (pageUrl && requestUrl.origin !== pageUrl.origin) {
      evidence.externalRequests.push(request.url());
    }
    if (request.method() === "POST" && /^\/s\/[^/]+\/view$/.test(requestUrl.pathname)) {
      evidence.viewRequests.push(request.url());
    }
  });
  page.on("response", (response) => {
    if (
      response.request().method() === "POST" &&
      /^\/s\/[^/]+\/view$/.test(new URL(response.url()).pathname)
    ) {
      evidence.viewResponses.push(response.status());
    }
  });
  return evidence;
}

async function auditTimelineContract(
  page: Page,
  testInfo: TestInfo,
  experienceId: string,
  caseName: string,
  response: Response | null,
  evidence: TimelineRuntimeEvidence,
) {
  if (experienceId === "tasks.page.app-timeline") {
    const artifact = page.locator("[data-master3-artifact]");
    await expect(artifact).toHaveCount(1);
    // The embedded owner preview must never share the signed-in address or
    // register a public view. Publishing remains an explicit owner action.
    await expect(artifact.getByRole("button", { name: "Share this timeline" })).toHaveCount(0);
    expect(evidence.viewRequests).toEqual([]);
    return;
  }
  if (experienceId === "tasks.page.app-timeline-audience-by-publication-id") {
    await expect(page.locator("[data-timeline-phone-preview]")).toBeVisible();
    await expect(page.locator("[data-master3-artifact]")).toHaveCount(2);
    await expect(page.locator("[data-timeline-phone-preview] [data-master3-artifact]")).toHaveAttribute("data-layout", "stack");
    await expect(page.locator("[data-master3-artifact]").getByRole("button", { name: "Share this timeline" })).toHaveCount(0);
    await expect(page.locator("[data-master3-follow]")).toHaveCount(0);
    await page.waitForTimeout(2_100);
    expect(evidence.viewRequests).toEqual([]);
    return;
  }
  if (experienceId !== "tasks.page.s-by-token") return;
  expect(response).not.toBeNull();
  if (!response) return;

  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(response.headers()["referrer-policy"]).toBe("no-referrer");
  expect(response.headers()["x-robots-tag"]).toContain("noindex");
  expect(response.headers()["content-security-policy"]).toContain("connect-src 'self'");

  if (caseName === "invalid bearer link") {
    // Next's streamed notFound boundary is intentionally a soft 404. The
    // privacy contract is the generic body plus no-store/noindex headers;
    // token validity is not disclosed by a distinct network response.
    expect(response.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Mara & Finn" })).toHaveCount(0);
    await expect(page.locator("[data-timeline-artifact]")).toHaveCount(0);
    return;
  }

  const artifact = page.locator("[data-master3-artifact]");
  await expect(artifact).toHaveCount(1);
  await expect(page.locator("[data-timeline-wordmark]")).toHaveText("timeline.");
  // Master3 retains one review clock: 16 July to 3 October is 79 days.
  // The desktop rail orders dates evenly; it is not the retired to-scale
  // interactive strip. The narrow layout presents the same dates first.
  await expect(artifact.getByRole("region", { name: "Timeline countdown" })).toContainText("79 days until Wedding day.");
  const target = artifact.getByRole("region", { name: "Wedding day", exact: true });
  await expect(target.locator("time").first()).toHaveAttribute("datetime", "2026-10-03");
  await expect(page.locator("[data-studio-rail], nav[aria-label='Products']")).toHaveCount(0);

  const stage = (page.viewportSize()?.width ?? 0) >= 1280;
  await expect(artifact).toHaveAttribute("data-layout", stage ? "stage" : "stack");
  const rail = artifact.locator('section[aria-label="Timeline"]');
  const phoneRows = artifact.locator('li[id^="m-"]');
  const dates = ["2026-01-02", "2026-04-18", "2026-08-01", "2026-08-08", "2026-08-22", "2026-08-29", "2026-09-05", "2026-09-19", "2026-10-03"];
  expect(await rail.locator("ol > li time").evaluateAll(nodes => nodes.map(node => node.getAttribute("datetime")))).toEqual(dates);
  expect(await phoneRows.locator(":scope > time").evaluateAll(nodes => nodes.map(node => node.getAttribute("datetime")))).toEqual(dates);
  await expect(rail.locator("li[data-next]")).toContainText("Menu tasting at The Orchard");
  await expect(artifact.locator('li[id="m-demo-audience-item-menu"]')).toHaveAttribute("data-next", "true");
  await expect(artifact.locator('li[id="m-demo-audience-item-menu"]')).toContainText("Next · In 16 days");
  const progress = artifact.getByRole("progressbar", { name: "Timeline progress" });
  if (stage) {
    await expect(rail).toBeVisible();
    await expect(phoneRows.first()).toBeHidden();
    await expect(progress).toHaveAttribute("aria-valuetext", "2 of 9 milestones done");
    await expect(artifact.getByRole("heading", { name: "Coming up" })).toBeVisible();
    await expect(artifact.locator("ul > li[data-next]")).toContainText("Menu tasting at The Orchard");
  } else {
    await expect(rail).toBeHidden();
    await expect(phoneRows.first()).toBeVisible();
    await expect(progress).toHaveCount(0);
    const order = await artifact.evaluate(node => {
      const row = node.querySelector('li[id^="m-"]');
      const action = [...node.querySelectorAll("button")].find(button => button.textContent?.includes("Add to my calendar") && button.getBoundingClientRect().height > 0);
      return !!row && !!action && row.getBoundingClientRect().top < action.getBoundingClientRect().top;
    });
    expect(order).toBe(true);
  }

  // Keyboard opens the real calendar menu and Escape returns focus without
  // downloading, navigating off-origin or exercising a delivery mutation.
  const calendar = artifact.getByRole("button", { name: "Add to my calendar", exact: true });
  await calendar.focus();
  await calendar.press("Enter");
  await expect(artifact.getByRole("menu", { name: "Add to my calendar" })).toBeVisible();
  await expect(artifact.getByRole("menuitem", { name: "Copy the date and place" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(calendar).toBeFocused();
  await expect(artifact.getByRole("menu")).toHaveCount(0);
  await expect(artifact.getByRole("textbox", { name: "Email address" })).toHaveCount(0);
  await expect(artifact.getByRole("button", { name: "Following", exact: true })).toHaveCount(0);

  if (testInfo.project.name === "mobile") {
    const minimumTarget = await page.locator("[data-timeline-artifact] button").evaluateAll(
      (buttons) => Math.min(...buttons.filter((button) => button instanceof HTMLElement && button.offsetParent).map((button) => button.getBoundingClientRect().height)),
    );
    expect(minimumTarget).toBeGreaterThanOrEqual(44);
  }

  await page.waitForTimeout(2_100);
  await expect.poll(() => evidence.viewRequests.length).toBe(1);
  await expect.poll(() => evidence.viewResponses).toEqual([204]);
  await page.waitForTimeout(100);
  expect(evidence.viewRequests).toHaveLength(1);
  expect(
    evidence.externalRequests.filter((url) => /clerk|google|sentry|posthog/i.test(url)),
  ).toEqual([]);
}

async function auditCurrentSurface(
  page: Page,
  testInfo: TestInfo,
  experienceId: string,
  caseName: string,
  assertions: StateAssertion[],
  runtime: RuntimeWatch,
  mainDocumentAllowance: MainDocumentAllowance,
  keyboardOnly: boolean,
  response: Response | null,
  timelineEvidence: TimelineRuntimeEvidence,
) {
  await expect(page.locator("main, [role=dialog]").first()).toBeVisible();
  // Audit the settled state, not the translucent first frames of an entrance
  // animation. Motion remains reduced at the browser-context level.
  await page.waitForTimeout(500);
  await expectNoDocumentOverflow(page);
  await expectNoBlockingAccessibilityIssues(page);
  if (keyboardOnly) await expectKeyboardEntry(page);
  await expectStateAssertions(page, assertions);
  await attachRenderedEvidence(page, testInfo, experienceId, caseName);
  await auditTimelineContract(
    page,
    testInfo,
    experienceId,
    caseName,
    response,
    timelineEvidence,
  );
  // Read the live issue buffer after the settled audit and screenshot. This
  // catches errors emitted during hydration, delayed chunks, Axe, or capture.
  expect(runtimeFailures(runtime, mainDocumentAllowance, page.url())).toEqual([]);
}

for (const fixture of routeCases) {
  test(`${fixture.experienceId} / ${fixture.name}`, async ({ page }, testInfo) => {
    const runtime = watchRuntime(page);
    const timelineEvidence = watchTimelineRuntime(page);
    const response = await page.goto(fixture.path, { waitUntil: "domcontentloaded" });
    expect(response).not.toBeNull();
    expect(response?.status()).toBe(fixture.expectedStatus ?? 200);
    if (fixture.experienceId === "tasks.page.app") {
      // Signal → Home consolidation (D1/D6): /app is the front door and
      // lands on Home. The fixture assertions repeat this; the explicit
      // wait keeps the redirect settled before the audit begins.
      await page.waitForURL("**/app/home");
      await expect(
        page.getByRole("heading", { name: "Good morning, Orla" }),
      ).toBeVisible();
    }
    await enterDeterministicMotionMode(page);
    await page.waitForTimeout(300);
    await auditCurrentSurface(
      page,
      testInfo,
      fixture.experienceId,
      fixture.name,
      fixture.assertions,
      runtime,
      fixture.expectedStatus === 404 && response
        ? { status: 404, url: response.url() }
        : null,
      fixture.states.includes("keyboard-only"),
      response,
      timelineEvidence,
    );
  });
}

test("tasks.surface.command-palette / keyboard search", async ({ page }, testInfo) => {
  const runtime = watchRuntime(page);
  const timelineEvidence = watchTimelineRuntime(page);
  const fixture = manifest.experiences.find(
    (entry) => entry.id === "tasks.surface.command-palette",
  );
  expect(fixture?.assertions).toBeDefined();
  await test.step("load the hydrated demo workspace", async () => {
    await page.goto("/app/tasks", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: "Tasks", level: 1 }),
    ).toBeVisible();
    await enterDeterministicMotionMode(page);
  });

  await test.step("open the palette with the keyboard shortcut", async () => {
    // ⌘K/Ctrl+K is the canonical universal-field shortcut since the
    // Studio Bar (T·94); ⌘P survives as the legacy alias.
    await page.keyboard.press("Control+K");
  });

  const dialog = page.getByRole("dialog", { name: "Command palette" });
  await test.step("enter a representative search query", async () => {
    await expect(dialog).toBeVisible();
    const search = dialog.getByPlaceholder("Search, jump or create…");
    await expect(search).toBeFocused();
    await page.keyboard.type("recommended suppliers");
    await expect(search).toHaveValue("recommended suppliers");
  });

  await auditCurrentSurface(
    page,
    testInfo,
    "tasks.surface.command-palette",
    "keyboard search",
    fixture?.assertions ?? [],
    runtime,
    null,
    true,
    null,
    timelineEvidence,
  );
});

test("tasks.surface.quick-create / long natural-language task", async ({ page }, testInfo) => {
  const runtime = watchRuntime(page);
  const timelineEvidence = watchTimelineRuntime(page);
  const fixture = manifest.experiences.find(
    (entry) => entry.id === "tasks.surface.quick-create",
  );
  expect(fixture?.assertions).toBeDefined();
  await page.goto("/app/tasks", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Tasks", level: 1 })).toBeVisible();
  await enterDeterministicMotionMode(page);
  await page.keyboard.press("c");
  const dialog = page.getByRole("dialog", { name: "New task" });
  await expect(dialog).toBeVisible();
  const taskName = dialog.getByRole("textbox", { name: "Task name" });
  const taskTitle =
    "Confirm the final supplier arrival plan with every Saturday contact next Thursday #maria-james";
  await expect(taskName).toBeFocused();
  await page.keyboard.type(taskTitle);
  await expect(taskName).toHaveValue(taskTitle);
  await auditCurrentSurface(
    page,
    testInfo,
    "tasks.surface.quick-create",
    "long natural-language task",
    fixture?.assertions ?? [],
    runtime,
    null,
    true,
    null,
    timelineEvidence,
  );
});

test("tasks.surface.task-detail-panel / populated task", async ({ page }, testInfo) => {
  const runtime = watchRuntime(page);
  const timelineEvidence = watchTimelineRuntime(page);
  const fixture = manifest.experiences.find(
    (entry) => entry.id === "tasks.surface.task-detail-panel",
  );
  expect(fixture?.assertions).toBeDefined();
  await page.goto("/app/tasks", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Tasks", level: 1 })).toBeVisible();
  await enterDeterministicMotionMode(page);
  await page.keyboard.press("Enter");
  // An opened task is a modal dialog at every width: the two-column task
  // view from 1024px, the sheet below. Both carry the task's name.
  const panel = page.getByRole("dialog", {
    name: "Confirm marquee sides with the hire company",
  });
  await expect(panel).toBeVisible();
  await auditCurrentSurface(
    page,
    testInfo,
    "tasks.surface.task-detail-panel",
    "populated task",
    fixture?.assertions ?? [],
    runtime,
    null,
    true,
    null,
    timelineEvidence,
  );
});

// Additional own-target cases preserve all original33 critical case identities.
for (const fixture of manifest.supplementalMaterialityRendered) {
  test(fixture.id + " / " + fixture.caseName, async ({ page }, testInfo) => {
    const runtime = watchRuntime(page);
    const ownComponent = fixture.kind === "component";
    const expectedError = ownComponent && fixture.id.endsWith("-error");
    const response = await page.goto(ownComponent ? "http://127.0.0.1:4409" + fixture.path : fixture.path, { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);
    await enterDeterministicMotionMode(page);
    if (fixture.kind === "resources") {
      await expect(page.getByRole("heading", { name: "Tasks", level: 1 })).toBeVisible();
      const task = page.getByRole("article", { name: "Confirm marquee sides with the hire company", exact: true });
      await expect(task).toBeVisible();
      await task.getByText("Confirm marquee sides with the hire company", { exact: true }).click();
      await expect(page.getByRole("dialog", { name: "Confirm marquee sides with the hire company" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Files and links" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Attach a file" })).toBeVisible();
    }
    await expect(page.locator(fixture.selector).first()).toBeVisible();
    if (fixture.kind === "route") {
      // Require actual route-specific content, rather than only the App shell.
      const names: Record<string,string> = {"tasks.page.app-settings":"Settings", "tasks.page.app-project":"The Orchard, events", "tasks.page.app-analytics":"Analytics", "tasks.page.app-concepts":"Concepts", "tasks.page.app-files":"Files", "tasks.page.welcome":"That project isn’t available.", "tasks.page.app-tools-by-slug":"Wedding hub"};
      if (fixture.id === "tasks.page.app-messages") {
        await expect(page.getByRole("main", { name: "Chat", exact: true })).toBeVisible();
        // A phone opens the directory first. Enter the real selected Project
        // conversation through the same row control as its reader.
        if (!await page.getByRole("navigation", { name: "Conversation views" }).isVisible()) {
          await page.getByRole("navigation", {name:"Conversations"}).getByRole("button", {name:/The Orchard, events/}).click();
        }
        await expect(page.getByRole("navigation", { name: "Conversation views" })).toBeVisible();
        await expect(page.getByRole("navigation", { name: "Conversation views" }).getByRole("button", { name: "Chat", exact: true })).toBeVisible();
      } else await expect(page.getByRole("heading", { name: names[fixture.id], exact: true }).first()).toBeVisible();
      if (fixture.id === "tasks.page.welcome") {
        // Empty explicit identity is refused before a membership query. This
        // proves the real route's recovery surface, not completed onboarding.
        await expect(page.getByRole("link", { name: "Open Home", exact: true })).toHaveAttribute("href", "/app/home");
        await expect(page.getByText("Open Home to choose a project you can use.", { exact: true })).toBeVisible();
      } else if (fixture.id === "tasks.page.app-tools-by-slug") {
        const projects = page.getByRole("region", { name: "Your wedding Projects", exact: true });
        await expect(projects).toBeVisible();
        const guestList = projects.getByRole("link", { name: /Open guest list/ }).first();
        await expect(guestList).toBeVisible();
        await expect(guestList).toHaveAttribute("href", /^\/app\/wedding\/guests\?workspaceId=/);
        await expect(page.getByRole("heading", { name: "More planning tools", exact: true })).toBeVisible();
      } else if (fixture.id === "tasks.page.app-analytics") {
        const standing = page.getByRole("region", { name: "Where we stand", exact: true });
        await expect(standing).toBeVisible();
        await expect(standing.getByRole("link", { name: /^Are we on track\?/ })).toBeVisible();
      } else if (fixture.id === "tasks.page.app-files") {
        const files = page.getByRole("region", { name: "Files", exact: true });
        await expect(files).toBeVisible();
        // Files now begins with real task folders. Enter the exact owning task
        // before checking its file and the sample preview's task custody.
        const folder = files.getByRole("list", { name: "Folders in this project", exact: true })
          .getByRole("button", { name: "Build the Saturday run-sheet, 1 file", exact: true });
        await expect(folder).toBeVisible();
        await folder.click();
        await expect(files.getByRole("navigation", { name: "File location", exact: true })).toContainText("Build the Saturday run-sheet");
        const file = files.getByRole("button", { name: /^Run-sheet, Saturday v3\.pdf Document/ });
        await expect(file).toBeVisible();
        await file.click();
        const sheet = page.getByRole("dialog", { name: "Run-sheet, Saturday v3.pdf", exact: true });
        const preview = sheet.or(page.getByRole("complementary", { name: "Run-sheet, Saturday v3.pdf", exact: true }));
        await expect(preview).toBeVisible();
        await expect(preview.getByRole("heading", { name: "Run-sheet, Saturday v3.pdf", exact: true })).toBeVisible();
        await expect(preview.getByRole("link", { name: "Build the Saturday run-sheet", exact: true })).toHaveAttribute("href", "/app/task/demo-t-05");
        await expect(preview.getByText("A sample file. In your own projects it opens from here.", { exact: true })).toBeVisible();
        if (await sheet.isVisible()) {
          await sheet.getByRole("button", { name: "Close", exact: true }).click();
          await expect(file).toBeFocused();
        }
      } else if (fixture.id === "tasks.page.app-concepts") {
        const overview = page.getByRole("region", { name: "Overview", exact: true });
        await expect(overview).toBeVisible();
        await expect(overview.getByRole("link").first()).toHaveAttribute("href", "/app/concepts/overview/1");
        await expect(page.getByText("Five or six directions for each view, using sample data. These are unpicked prototypes for review.", { exact: true })).toBeVisible();
      }
    }
    await page.waitForTimeout(500);
    if (expectedError) {
      await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
      await page.getByRole("button", { name: "Try again" }).click();
      expect(await page.evaluate(() => (window as unknown as {__materiality: {retryCount: number}}).__materiality.retryCount)).toBe(1);
      await expect(page.getByRole("link", {name:"Open Tasks"})).toHaveAttribute("href", "/app/tasks");
      const prefix = fixture.id.includes("home") ? "home" : fixture.id.includes("analytics") ? "analytics" : "files";
      removeDeclaredComponentError(runtime, prefix, fixture.id);
    }
    await expectNoDocumentOverflow(page);
    await expectNoBlockingAccessibilityIssues(page);
    await attachRenderedEvidence(page, testInfo, fixture.id, fixture.caseName);
    await testInfo.attach("own-target-source-and-scope", { body: JSON.stringify({id: fixture.id, source: fixture.source, states:fixture.states, scope:ownComponent?"actual component render; synthetic Error/local retry callback/anchor seam only":"actual demo App surface; no provider/authenticated production claim"}), contentType:"application/json" });
    expect(runtimeFailures(runtime, null, page.url())).toEqual([]);
  });
}
