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
const briefingLedger = readFileSync(
  new URL("../../components/brief/quiet-briefing-ledger.tsx", import.meta.url),
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

test("the progressive path renders one Quiet Ledger without the analytics shell", () => {
  assert.match(
    briefingPage,
    /<section id="signal-main-content"[\s\S]*<QuietBriefingLedger ledger=\{ledger\} \/>[\s\S]*<\/section>/,
  );
  assert.match(briefingPage, /<EvidenceDrawer/);
  assert.doesNotMatch(briefingPage, /SignalAppShell/);
});

test("progressive analytics remains explicitly off by default", () => {
  assert.match(featureFlag, /if \(configured === "true"[\s\S]*return true;/);
  assert.match(featureFlag, /if \(configured === "false"[\s\S]*return false;/);
  assert.match(featureFlag, /return false;\s*\n}/);
  assert.doesNotMatch(featureFlag, /isProductionMode/);
});

test("Signal surfaces only verified in-app briefing behavior", () => {
  assert.doesNotMatch(notificationsPage, /<main\b/);
  assert.match(notificationsPage, /<section[\s\S]*In app only[\s\S]*<\/section>/);
  assert.doesNotMatch(
    `${notificationsPage}\n${cadenceForm}\n${briefingLedger}`,
    /tomorrow,\s*6am|06:00|unsubscribe|every email|sends a short morning briefing/i,
  );
});

test("the Quiet Ledger action keeps raw source ids behind a server rebuild", () => {
  assert.match(briefingLedger, /action=\{openSignalLedgerEntry\}/);
  assert.match(
    briefingLedger,
    /type="hidden" name="entryId" value=\{entry\.id\}/,
  );
  assert.doesNotMatch(briefingLedger, /name="(?:taskId|workspaceId)"/);
  assert.match(ledgerAction, /await buildBriefingForUser\(/);
  assert.match(ledgerAction, /signalScopeHintFromReferer/);
  assert.match(ledgerAction, /legacyLedgerTasksHref\(/);
  assert.match(
    ledgerAction,
    /planningPeriodId: REVIEW_SUITE_FIXTURE\.workspace\.planningPeriodId/,
  );
  assert.match(ledgerAction, /projectId: REVIEW_PRIMARY_PROJECT\.id/);
});

test("Signal loading and disclosure controls announce their state", () => {
  assert.match(loading, /role="status"/);
  assert.match(loading, /aria-live="polite"/);
  assert.match(loading, /Building your Signal briefing/);
  assert.match(briefingLedger, /aria-controls=\{panelId\}/);
  assert.match(briefingLedger, /id=\{panelId\}/);
  assert.match(briefingLedger, /min-h-11/);
});
