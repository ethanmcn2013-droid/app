import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const timelineRoot = path.join(
  process.cwd(),
  "src",
  "modules",
  "timeline",
);

function read(relativePath) {
  return fs.readFileSync(path.join(timelineRoot, relativePath), "utf8");
}

test("owner milestone ordering has focusable controls and polite confirmation", () => {
  const source = read(
    "app/plan/[projectSlug]/_components/curation-surface.tsx",
  );

  assert.match(source, /aria-label=\{`Move \$\{node\.title\} up`\}/);
  assert.match(source, /aria-label=\{`Move \$\{node\.title\} down`\}/);
  assert.match(source, /buildOwnerKeyboardReorder/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /Position \$\{result\.position\} of \$\{result\.siblingCount\}/);
});

test("automatic Tasks sync failure remains visible and retryable", () => {
  const source = read(
    "app/plan/[projectSlug]/_components/curation-surface.tsx",
  );

  assert.match(source, /autoSyncState\.status === "error"/);
  assert.match(source, /Tasks milestones could not refresh automatically/);
  assert.match(source, /Retry sync/);
  assert.match(source, /onClick=\{\(\) => void runAutoSync\(\)\}/);
});

test("a sync refusal that Retry cannot fix offers no Retry", () => {
  // WP1. Every sync refusal used to render as role="alert" with a Retry
  // button. Once an archived Project and a revoked Project became refusals
  // rather than silent successes, their owners met a screen-reader-announced
  // alert and a button that could never work, on EVERY edit-mode load. An
  // assertive interruption should mean something has gone wrong and something
  // can be done about it; neither is true of a settled state.
  const source = read(
    "app/plan/[projectSlug]/_components/curation-surface.tsx",
  );

  // The alert path is now conditional on the refusal being retryable...
  assert.match(
    source,
    /autoSyncState\.status === "error" && autoSyncState\.retryable \? \(/,
    "the assertive alert and its Retry must be reserved for refusals that " +
      "retrying could actually change",
  );

  // ...and the settled path is polite, and carries no control at all.
  //
  // Anchored on the ELEMENT, not on the condition. The same condition now also
  // appears where the Sync button is told it is disabled, earlier in the file,
  // and an indexOf on the condition sliced that instead — swallowing the alert
  // block and failing for the wrong reason. A guard that can point at the
  // wrong code is a guard that can pass for the wrong reason too.
  const settledStart = source.indexOf("id={SETTLED_REFUSAL_ID}");
  assert.ok(settledStart !== -1, "the settled refusal statement is missing");
  const block = source.slice(settledStart);
  const settled = block.slice(0, block.indexOf("</p>"));
  assert.match(settled, /role="status"/, "a settled state is polite, not assertive");
  assert.ok(
    !/<button/.test(settled),
    "a settled refusal must not offer a control that cannot change it",
  );
  assert.ok(
    !/role="alert"/.test(settled),
    "a settled refusal must not interrupt the reader on every load",
  );
});

test("a settled refusal is stated once, and the control that cannot act says so", () => {
  // The refusal block sits directly below the Sync button, and `onSync` only
  // fires on success, so the block was never cleared. An archived Project's
  // owner met the settled line, an ENABLED "Sync from Tasks" above it, and —
  // on pressing it — the identical sentence again as role="alert". The same
  // fact, twice, at two severities, beside a control the block itself says
  // cannot help.
  const source = read(
    "app/plan/[projectSlug]/_components/curation-surface.tsx",
  );

  // The button is disabled by the settled refusal, not merely by pending.
  assert.match(
    source,
    /disabled=\{isPending \|\| settledRefusal !== null\}/,
    "the Sync control must be disabled when refreshing has already been " +
      "refused for a reason that will not change",
  );
  // And it names the reason, rather than being inert without explanation.
  assert.match(
    source,
    /aria-describedby=\{settledRefusal \? SETTLED_REFUSAL_ID : undefined\}/,
    "a disabled control must say why it is disabled",
  );
  assert.match(
    source,
    /id=\{SETTLED_REFUSAL_ID\}/,
    "the settled statement must carry the id the button points at",
  );
  // The button's own alert cannot restate what the settled block already says.
  assert.match(
    source,
    /result === "error" && settledRefusal === null &&/,
    "the manual path must not repeat a settled refusal that is already on " +
      "screen",
  );
});

test("one-time audience link copy has an announced manual recovery path", () => {
  // The share controls were extracted from audience-manager.tsx so the project
  // Share panel and the manager cannot drift apart. The recovery path itself is
  // unchanged; only its address is.
  const source = read("app/audience/share-controls.tsx");

  assert.match(source, /try \{/);
  assert.match(source, /catch \{/);
  assert.match(source, /Automatic copy was blocked/);
  assert.match(source, /Select link again/);
  assert.match(source, /role="status"/);
  assert.match(source, /requestAnimationFrame\(selectLink\)/);
});

test("Timeline loading boundaries announce progress without exposing skeletons", () => {
  // The project-first route owns one module loading boundary; the retired
  // dashboard skeleton (app/loading.tsx) was deleted with the dashboard it
  // described. The bearer-link loading state lives outside the module and
  // is pinned here so the two boundaries cannot drift apart in register.
  for (const relativePath of ["app/plan/[projectSlug]/loading.tsx"]) {
    const source = read(relativePath);
    assert.match(source, /role="status"/);
    assert.match(source, /aria-live="polite"/);
    assert.match(source, /aria-hidden/);
  }

  const sharedLoading = fs.readFileSync(
    new URL("../../app/s/[token]/loading.tsx", import.meta.url),
    "utf8",
  );
  assert.match(sharedLoading, /role="status"/);
  assert.match(sharedLoading, /aria-live="polite"/);
  assert.match(sharedLoading, /motion-reduce:animate-none/);
});

test("owner controls meet the 44px mobile target and error copy stays factual", () => {
  const projectPage = read("app/plan/[projectSlug]/page.tsx");
  const audienceManager = read("app/audience/share-controls.tsx");
  const errorBoundary = read("app/error.tsx");

  // Assert the literal 44px, not `min-h-11`. This repo remaps Tailwind's
  // numeric spacing scale (--space-11 is 80px), so `min-h-11` asserted a token
  // that rendered these controls at 80px while this assertion's own message
  // promised 44px. A bracketed 44px cannot drift with the scale.
  assert.equal(
    (projectPage.match(/min-h-\[44px\]/g) ?? []).length >= 2,
    true,
    "both owner mode controls must be at least 44px high",
  );
  assert.doesNotMatch(
    projectPage,
    /min-h-11\b/,
    "min-h-11 is 80px on this scale — use min-h-[44px] for tap targets",
  );
  assert.match(
    audienceManager,
    /const primaryButton =\s*\n\s*`\$\{styles\.focusable\}[^`]*\bmin-h-\[44px\]/,
  );
  assert.match(
    audienceManager,
    /import styles from "\.\/share-controls\.module\.css"/,
  );
  assert.doesNotMatch(errorBoundary, /Nothing was lost|your .* (?:is|are) saved/i);
  assert.match(errorBoundary, /could not finish loading/);
});

test("manual milestone add restores focus to its initiating control", () => {
  const source = read(
    "app/plan/[projectSlug]/_components/curation-surface.tsx",
  );

  assert.match(source, /manualAddTriggerRef/);
  assert.match(source, /requestAnimationFrame\(\(\) => \{/);
  assert.match(source, /manualAddTriggerRef\.current\?\.focus\(\)/);
  assert.match(source, /onClose\("complete"\)/);
  assert.match(source, /restoreFocusAfterNodeCount/);
  assert.equal(
    (source.match(/onClose=\{closeManualAdd\}/g) ?? []).length,
    2,
  );
});
