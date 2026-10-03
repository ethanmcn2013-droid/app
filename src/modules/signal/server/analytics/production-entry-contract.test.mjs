import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pageContext = readFileSync(
  new URL("./page-context.ts", import.meta.url),
  "utf8",
);
const onboarding = readFileSync(
  new URL("../../app/onboarding/signal-onboarding-page.tsx", import.meta.url),
  "utf8",
);
const onboardingPicker = readFileSync(
  new URL("../../app/onboarding/signal-onboarding-picker.tsx", import.meta.url),
  "utf8",
);
const briefingPage = readFileSync(
  new URL("../../app/signal-brief-page.tsx", import.meta.url),
  "utf8",
);
const overviewView = readFileSync(
  new URL("../../components/overview/overview-view.tsx", import.meta.url),
  "utf8",
);
const overviewActions = readFileSync(
  new URL("../../components/overview/overview-actions.tsx", import.meta.url),
  "utf8",
);
const overviewStyles = readFileSync(
  new URL("../../components/overview/overview.module.css", import.meta.url),
  "utf8",
);
const legacyBriefing = readFileSync(
  new URL("../../app/signal-legacy-briefing.tsx", import.meta.url),
  "utf8",
);
const ledgerAction = readFileSync(
  new URL("../../app/signal-ledger-actions.ts", import.meta.url),
  "utf8",
);
const loading = readFileSync(
  new URL("../../app/signal-brief-loading.tsx", import.meta.url),
  "utf8",
);
const notificationsPage = readFileSync(
  new URL(
    "../../app/settings/notifications/signal-notifications-page.tsx",
    import.meta.url,
  ),
  "utf8",
);
const cadenceForm = readFileSync(
  new URL(
    "../../app/settings/notifications/signal-cadence-form.tsx",
    import.meta.url,
  ),
  "utf8",
);
const featureFlag = readFileSync(
  new URL("./feature-flag.ts", import.meta.url),
  "utf8",
);

test("Signal provisions a shared identity before resolving live workspaces", () => {
  assert.match(
    pageContext,
    /await ensureUserProvisioned\(userId\);[\s\S]*await listWorkspaceOptions\(userId\);/,
  );
  assert.match(
    pageContext,
    /or\(eq\(users\.clerkId, clerkId\), eq\(users\.id, clerkId\)\)/,
  );
});

test("Signal onboarding only redirects when its linked workspace still exists", () => {
  assert.match(onboarding, /getAnalyticsUser\(userId\)/);
  assert.match(
    onboarding,
    /candidates\.some\([\s\S]*candidate\.workspaceId === analyticsUser\?\.linkedWorkspaceId/,
  );
  assert.doesNotMatch(onboarding, /if \(await isOnboarded\(userId\)\)/);
  assert.doesNotMatch(onboarding, /each morning/i);
  assert.match(onboardingPicker, /await completeOnboarding\(formData\)/);
  assert.match(onboardingPicker, /catch \{/);
  assert.match(onboardingPicker, /role="alert"/);
  assert.match(onboardingPicker, /role="status"/);
});

test("both engines render one Overview, and the progressive path keeps its drawer without the analytics shell", () => {
  assert.match(
    briefingPage,
    /<section id="signal-main-content"[\s\S]*<OverviewView model=\{model\} \/>[\s\S]*<\/section>/,
  );
  assert.match(briefingPage, /<EvidenceDrawer/);
  assert.doesNotMatch(briefingPage, /SignalAppShell/);
  assert.match(legacyBriefing, /<OverviewView/);
  // One build feeds the page: the ledger and the engine's own signals from
  // the same buildBriefingForUser result, never a second read.
  assert.equal(legacyBriefing.match(/buildBriefingForUser\(/g)?.length, 1);
  assert.match(legacyBriefing, /signals: result\.signals/);
});

/**
 * Renegotiated at WP4-A, not weakened (DECISIONS.md D-007).
 *
 * This used to pin one function's literal shape: a `"true"` branch, a
 * `"false"` branch, and a trailing bare `return false;`. D-011 split that
 * function in two — `SIGNAL_ANALYTICS_V1_ENABLED` is a briefing-engine switch
 * and could not open the analytics domain without replacing the shipped Full
 * Briefing, so `SIGNAL_HOME_ANALYTICS_ENABLED` now gates the view — and the
 * shared parsing moved into `readFlag`, which the old regexes cannot see.
 *
 * The invariant is unchanged and is now asserted on BOTH flags: closed unless
 * a recognised true is set, an explicit false always wins, and no gate is
 * derived from the deployment mode. `feature-flag.test.ts` proves the same
 * invariant behaviourally rather than by source text; this guard remains as
 * the thing that fails if a third flag appears without one.
 */
test("progressive analytics remains explicitly off by default", () => {
  assert.match(featureFlag, /if \(configured === "true" \|\| configured === "1"\) return true;/);
  assert.match(featureFlag, /if \(configured === "false" \|\| configured === "0"\) return false;/);
  assert.match(featureFlag, /return null;\s*\n}/);

  // Every exported gate must fall closed on an absent or unrecognised value.
  const gates = featureFlag.match(/export function is\w+\(\): boolean \{[\s\S]*?\n}/g) ?? [];
  assert.equal(gates.length, 3, "the engine gate, the Home gate, and the domain gate");
  for (const gate of gates) {
    assert.ok(
      /\?\? false;/.test(gate) || /isSignalAnalyticsEnabled\(\) \|\| isHomeAnalyticsEnabled\(\)/.test(gate),
      `a gate that does not default to false: ${gate.slice(0, 80)}`,
    );
  }

  assert.match(featureFlag, /process\.env\.SIGNAL_ANALYTICS_V1_ENABLED/);
  assert.match(featureFlag, /process\.env\.SIGNAL_HOME_ANALYTICS_ENABLED/);
  assert.doesNotMatch(featureFlag, /isProductionMode/);
});

test("Signal surfaces only verified in-app briefing behavior", () => {
  assert.doesNotMatch(notificationsPage, /<main\b/);
  assert.match(notificationsPage, /<section[\s\S]*In app only[\s\S]*<\/section>/);
  assert.doesNotMatch(
    `${notificationsPage}\n${cadenceForm}\n${overviewView}`,
    /tomorrow,\s*6am|06:00|unsubscribe|every email|sends a short morning briefing/i,
  );
});

test("the Overview's open action keeps raw source ids behind a server rebuild", () => {
  assert.match(overviewActions, /action=\{openSignalLedgerEntry\}/);
  assert.match(
    overviewActions,
    /type="hidden" name="entryId" value=\{entryId\}/,
  );
  assert.match(overviewView, /<OpenInTasks entryId=\{entry\.id\}/);
  assert.doesNotMatch(
    `${overviewView}\n${overviewActions}`,
    /name="(?:taskId|workspaceId)"/,
  );
  assert.match(ledgerAction, /await buildBriefingForUser\(/);
  assert.match(ledgerAction, /signalScopeHintFromReferer/);
  assert.match(ledgerAction, /legacyLedgerTasksHref\(/);
  assert.match(
    ledgerAction,
    /planningPeriodId: REVIEW_SUITE_FIXTURE\.workspace\.planningPeriodId/,
  );
  assert.match(ledgerAction, /projectId: REVIEW_PRIMARY_PROJECT\.id/);
});

test("Overview loading and disclosure controls announce their state", () => {
  assert.match(loading, /role="status"/);
  assert.match(loading, /aria-live="polite"/);
  assert.match(loading, /Reading your Overview/);
  assert.match(overviewActions, /aria-controls=\{panelId\}/);
  assert.match(overviewActions, /aria-expanded=\{open\}/);
  assert.match(overviewActions, /id=\{panelId\}/);
  // A collapsed panel stays in the document so aria-controls resolves, and
  // leaves the tab order and accessibility tree while it is closed.
  assert.match(overviewActions, /inert=\{!open\}/);
  // Touch targets are pinned by their real height wherever the pointer is a
  // finger. Never `min-h-11`: this design system maps --space-11 to 80px.
  assert.match(
    overviewStyles,
    /@media \(pointer: coarse\) \{[\s\S]*?\.action,[\s\S]*?\.whyToggle,[\s\S]*?min-height:\s*44px/,
  );
  assert.doesNotMatch(`${overviewView}\n${overviewActions}`, /min-h-11\b/);
});

test("the Overview reveals itself without waiting for hydration", () => {
  // An `initial="hidden"` motion variant ships the page at opacity 0 and
  // reveals it on hydration, so the honest skeleton hands off to a blank
  // page. The entrance is CSS on server-rendered markup instead, and the
  // view itself is a server component.
  assert.doesNotMatch(`${overviewView}\n${overviewActions}`, /initial="hidden"/);
  assert.doesNotMatch(overviewView, /^"use client"/);
  assert.match(overviewStyles, /@keyframes ov-rise/);
  assert.match(
    overviewStyles,
    /prefers-reduced-motion: reduce[\s\S]*animation: none/,
  );
});

test("the primary action reports its own busy state without dropping focus", () => {
  assert.match(overviewActions, /useFormStatus/);
  // `aria-disabled`, never `disabled`: a disabled control drops keyboard
  // focus to <body> and the reader loses their place. The click guard is
  // what actually prevents the second submit, and a polite status is the
  // announcement a disabled button can never make.
  assert.match(overviewActions, /aria-disabled=\{pending\}/);
  assert.doesNotMatch(overviewActions, /\sdisabled=\{pending\}/);
  assert.match(overviewActions, /if \(pending\) event\.preventDefault\(\)/);
  assert.match(overviewActions, /role="status"[\s\S]*aria-live="polite"/);
});

test("the entrance never fades, so the frame after the skeleton is content", () => {
  // An opacity ramp leaves the handoff frame blank for the whole entrance.
  // The page rise, the bar draw and the runway marks animate transform or
  // clip only.
  const keyframes = overviewStyles.match(/@keyframes [\w-]+ \{[\s\S]*?\n\}/g) ?? [];
  assert.ok(keyframes.length >= 1, "the Overview entrance keyframes must exist");
  for (const block of keyframes) assert.doesNotMatch(block, /opacity/);
});
