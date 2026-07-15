import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
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
          resourceType: request.resourceType(),
          status: response.status(),
          url: response.url(),
        },
        page.url(),
      )
    ) {
      intentionalEventSourceTeardowns.add(normalizeUrl(response.url()));
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
  return { issues, intentionalEventSourceTeardowns };
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

async function auditCurrentSurface(
  page: Page,
  testInfo: TestInfo,
  experienceId: string,
  caseName: string,
  assertions: StateAssertion[],
  runtime: RuntimeWatch,
  mainDocumentAllowance: MainDocumentAllowance,
  keyboardOnly: boolean,
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
  // Read the live issue buffer after the settled audit and screenshot. This
  // catches errors emitted during hydration, delayed chunks, Axe, or capture.
  expect(runtimeFailures(runtime, mainDocumentAllowance, page.url())).toEqual([]);
}

for (const fixture of routeCases) {
  test(`${fixture.experienceId} / ${fixture.name}`, async ({ page }, testInfo) => {
    const runtime = watchRuntime(page);
    const response = await page.goto(fixture.path, { waitUntil: "domcontentloaded" });
    expect(response).not.toBeNull();
    expect(response?.status()).toBe(fixture.expectedStatus ?? 200);
    if (fixture.experienceId === "tasks.page.app") {
      await page.waitForURL("**/app/board");
      await expect(page.getByRole("heading", { name: "Hartwell Wedding" })).toBeVisible();
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
    );
  });
}

test("tasks.surface.command-palette / keyboard search", async ({ page }, testInfo) => {
  const runtime = watchRuntime(page);
  const fixture = manifest.experiences.find(
    (entry) => entry.id === "tasks.surface.command-palette",
  );
  expect(fixture?.assertions).toBeDefined();
  await test.step("load the hydrated demo workspace", async () => {
    await page.goto("/app/board", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: "Hartwell Wedding" }),
    ).toBeVisible();
    await enterDeterministicMotionMode(page);
  });

  await test.step("open the palette with the keyboard shortcut", async () => {
    await page.keyboard.press("Control+P");
  });

  const dialog = page.getByRole("dialog", { name: "Command palette" });
  await test.step("enter a representative search query", async () => {
    await expect(dialog).toBeVisible();
    const search = dialog.getByPlaceholder("Search tasks by title, tag, or description");
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
  );
});

test("tasks.surface.quick-create / long natural-language task", async ({ page }, testInfo) => {
  const runtime = watchRuntime(page);
  const fixture = manifest.experiences.find(
    (entry) => entry.id === "tasks.surface.quick-create",
  );
  expect(fixture?.assertions).toBeDefined();
  await page.goto("/app/board", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Hartwell Wedding" })).toBeVisible();
  await enterDeterministicMotionMode(page);
  await page.keyboard.press("c");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const taskName = dialog.getByPlaceholder(/Name a task/);
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
  );
});

test("tasks.surface.task-detail-panel / populated task", async ({ page }, testInfo) => {
  const runtime = watchRuntime(page);
  const fixture = manifest.experiences.find(
    (entry) => entry.id === "tasks.surface.task-detail-panel",
  );
  expect(fixture?.assertions).toBeDefined();
  await page.goto("/app/board", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Hartwell Wedding" })).toBeVisible();
  await enterDeterministicMotionMode(page);
  await page.keyboard.press("Enter");
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
  );
});
