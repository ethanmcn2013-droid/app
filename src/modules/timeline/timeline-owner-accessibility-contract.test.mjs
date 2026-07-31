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

test("one-time audience link copy has an announced manual recovery path", () => {
  const source = read("app/audience/audience-manager.tsx");

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
  const audienceManager = read("app/audience/audience-manager.tsx");
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
    /const primaryButton =\s*\n\s*"[^"]*\bmin-h-\[44px\]/,
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
